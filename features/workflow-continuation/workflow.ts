import {
  Annotation,
  END,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import {
  type AuthorityOutcome,
  type DecisionAuthority,
  type EvidenceGateOutcome,
  type OwnerDecisionOutcome,
  type OwnerDecisionResponse,
  type OwnerInterruptPayload,
  type SideEffectDisposition,
  type WorkflowInput,
  type WorkflowStatus,
  type WorkflowStep,
  WORKFLOW_SCHEMA_VERSION,
} from "./contracts.ts";
import type {
  AuthorityRouter,
  EvidenceGateAdapter,
  SqliteSideEffectLedger,
} from "./adapters.ts";

function replaceValue<T>(createDefault: () => T) {
  return Annotation<T>({
    reducer: (_current, update) => update,
    default: createDefault,
  });
}

export const WorkflowStateAnnotation = Annotation.Root({
  workflowSchemaVersion: replaceValue<string>(() => ""),
  workflowRunId: replaceValue<string>(() => ""),
  threadId: replaceValue<string>(() => ""),
  evidence: replaceValue<WorkflowInput["evidence"]>(() => ({
    reference: "",
    status: "MISSING",
    source: "OPERATIONAL_DATA_LAYER_ADAPTER_FIXTURE",
    checkedAt: "",
  })),
  authorityFixture: replaceValue<WorkflowInput["authorityFixture"]>(() => ({
    routeKey: "",
    actorRole: "",
    requestedTransition: "",
  })),
  failStepBOnce: replaceValue<boolean>(() => false),
  evidenceGateOutcome: replaceValue<EvidenceGateOutcome>(() => "NOT_CHECKED"),
  evidenceGateReason: replaceValue<string | null>(() => null),
  verifiedEvidenceReference: replaceValue<string | null>(() => null),
  authorityOutcome: replaceValue<AuthorityOutcome>(() => "NOT_CHECKED"),
  authorityReason: replaceValue<string | null>(() => null),
  decisionAuthority: replaceValue<DecisionAuthority>(() => "UNRESOLVED"),
  ownerDecisionResponse: replaceValue<OwnerDecisionResponse | null>(() => null),
  ownerDecisionOutcome: replaceValue<OwnerDecisionOutcome>(() => "PENDING"),
  workflowStatus: replaceValue<WorkflowStatus>(() => "READY"),
  blockReason: replaceValue<string | null>(() => null),
  stepHistory: replaceValue<WorkflowStep[]>(() => []),
  eventHistory: replaceValue<string[]>(() => []),
  sideEffectDisposition: replaceValue<SideEffectDisposition>(
    () => "NOT_ATTEMPTED",
  ),
  routineOwnerPromptCount: replaceValue<number>(() => 0),
  ownerDecisionResponseCount: replaceValue<number>(() => 0),
  runtimeBoundary: replaceValue<"WORKFLOW_RUNTIME_ONLY">(
    () => "WORKFLOW_RUNTIME_ONLY",
  ),
});

export type WorkflowState = typeof WorkflowStateAnnotation.State;

export interface WorkflowGraphDependencies {
  evidenceGate: EvidenceGateAdapter;
  authorityRouter: AuthorityRouter;
  sideEffects: SqliteSideEffectLedger;
}

export class WorkflowFixtureFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowFixtureFailure";
  }
}

function appendEvent(state: WorkflowState, event: string): string[] {
  return [...state.eventHistory, event];
}

function appendStep(state: WorkflowState, step: WorkflowStep): WorkflowStep[] {
  return [...state.stepHistory, step];
}

export function createWorkflowGraph({
  evidenceGate,
  authorityRouter,
  sideEffects,
}: WorkflowGraphDependencies) {
  const loadState: typeof WorkflowStateAnnotation.Node = async (state) => {
    const valid =
      state.workflowSchemaVersion === WORKFLOW_SCHEMA_VERSION &&
      state.workflowRunId.trim() !== "" &&
      state.threadId.trim() !== "";

    if (!valid) {
      return {
        workflowStatus: "BLOCKED",
        blockReason: "workflow_state_invalid",
        eventHistory: appendEvent(state, "LOAD_STATE_BLOCKED"),
      };
    }

    return {
      workflowStatus: "RUNNING",
      eventHistory: appendEvent(state, "LOAD_STATE"),
    };
  };

  const runEvidenceGate: typeof WorkflowStateAnnotation.Node = async (state) => {
    if (state.workflowStatus === "BLOCKED") {
      return {
        evidenceGateOutcome: "BLOCK",
        evidenceGateReason: state.blockReason,
        eventHistory: appendEvent(state, "EVIDENCE_GATE_BLOCKED"),
      };
    }

    const decision = evidenceGate.evaluate(state.evidence);

    if (decision.outcome === "BLOCK") {
      return {
        evidenceGateOutcome: "BLOCK",
        evidenceGateReason: decision.reason,
        verifiedEvidenceReference: decision.evidenceReference,
        workflowStatus: "BLOCKED",
        blockReason: decision.reason,
        eventHistory: appendEvent(state, "EVIDENCE_GATE_BLOCKED"),
      };
    }

    return {
      evidenceGateOutcome: "PASS",
      evidenceGateReason: null,
      verifiedEvidenceReference: decision.evidenceReference,
      eventHistory: appendEvent(state, "EVIDENCE_GATE_PASS"),
    };
  };

  const runAuthorityRoute: typeof WorkflowStateAnnotation.Node = async (state) => {
    const decision = authorityRouter.route(state.authorityFixture);

    if (decision.outcome === "BLOCK") {
      return {
        authorityOutcome: "BLOCK",
        authorityReason: decision.reason,
        decisionAuthority: "UNRESOLVED",
        workflowStatus: "BLOCKED",
        blockReason: decision.reason,
        eventHistory: appendEvent(state, "AUTHORITY_ROUTE_BLOCKED"),
      };
    }

    return {
      authorityOutcome: "AUTHORIZED",
      authorityReason: null,
      decisionAuthority: decision.decisionAuthority,
      eventHistory: appendEvent(state, "AUTHORITY_ROUTE_AUTHORIZED"),
    };
  };

  const stepA: typeof WorkflowStateAnnotation.Node = async (state) => ({
    stepHistory: appendStep(state, "STEP_A"),
    eventHistory: appendEvent(state, "STEP_A"),
  });

  const stepB: typeof WorkflowStateAnnotation.Node = async (state) => {
    const disposition = await sideEffects.record({
      idempotencyKey: `${state.workflowRunId}:STEP_B`,
      threadId: state.threadId,
      workflowRunId: state.workflowRunId,
      step: "STEP_B",
      payload: {
        purpose: "poc_duplicate_side_effect_protection",
        evidenceReference: state.verifiedEvidenceReference,
      },
    });

    if (state.failStepBOnce && disposition === "APPLIED") {
      throw new WorkflowFixtureFailure("step_b_failure_after_side_effect");
    }

    return {
      stepHistory: appendStep(state, "STEP_B"),
      eventHistory: appendEvent(
        state,
        disposition === "APPLIED"
          ? "STEP_B_SIDE_EFFECT_APPLIED"
          : "STEP_B_SIDE_EFFECT_DUPLICATE_SKIPPED",
      ),
      sideEffectDisposition: disposition,
    };
  };

  const stepC: typeof WorkflowStateAnnotation.Node = async (state) => ({
    stepHistory: appendStep(state, "STEP_C"),
    eventHistory: appendEvent(state, "STEP_C"),
    workflowStatus:
      state.decisionAuthority === "OWNER_ONLY" ? "WAITING_OWNER" : "RUNNING",
  });

  const ownerGate: typeof WorkflowStateAnnotation.Node = async (state) => {
    if (state.decisionAuthority !== "OWNER_ONLY") {
      return {
        ownerDecisionOutcome: "NOT_REQUIRED",
        eventHistory: appendEvent(state, "OWNER_INTERRUPT_NOT_REQUIRED"),
      };
    }

    const response = interrupt<OwnerInterruptPayload, OwnerDecisionResponse>({
      kind: "OWNER_ONLY_DECISION",
      threadId: state.threadId,
      workflowRunId: state.workflowRunId,
      question: "Continue this bounded workflow to Step D?",
      allowedDecisions: ["CONTINUE", "STOP"],
    });

    return {
      ownerDecisionResponse: response,
      eventHistory: appendEvent(state, "OWNER_INTERRUPT_RESUMED"),
    };
  };

  const ownerDecision: typeof WorkflowStateAnnotation.Node = async (state) => {
    if (state.decisionAuthority !== "OWNER_ONLY") {
      return {
        ownerDecisionOutcome: "NOT_REQUIRED",
        eventHistory: appendEvent(state, "OWNER_DECISION_NOT_REQUIRED"),
      };
    }

    const response = state.ownerDecisionResponse;
    const responseCount = state.ownerDecisionResponseCount + 1;

    if (
      !response ||
      response.actor !== "OWNER" ||
      response.decisionReference.trim() === "" ||
      !["CONTINUE", "STOP"].includes(response.decision)
    ) {
      return {
        ownerDecisionOutcome: "INVALID",
        ownerDecisionResponseCount: responseCount,
        workflowStatus: "BLOCKED",
        blockReason: "owner_decision_invalid_or_unauthorized",
        eventHistory: appendEvent(state, "OWNER_DECISION_BLOCKED"),
      };
    }

    if (response.decision === "STOP") {
      return {
        ownerDecisionOutcome: "STOP",
        ownerDecisionResponseCount: responseCount,
        workflowStatus: "OWNER_STOPPED",
        eventHistory: appendEvent(state, "OWNER_DECISION_STOP"),
      };
    }

    return {
      ownerDecisionOutcome: "CONTINUE",
      ownerDecisionResponseCount: responseCount,
      workflowStatus: "RUNNING",
      eventHistory: appendEvent(state, "OWNER_DECISION_CONTINUE"),
    };
  };

  const stepD: typeof WorkflowStateAnnotation.Node = async (state) => ({
    stepHistory: appendStep(state, "STEP_D"),
    eventHistory: appendEvent(state, "STEP_D"),
    workflowStatus: "ENDED",
  });

  return new StateGraph(WorkflowStateAnnotation)
    .addNode("load_state", loadState)
    .addNode("evidence_gate", runEvidenceGate)
    .addNode("authority_route", runAuthorityRoute)
    .addNode("step_a", stepA)
    .addNode("step_b", stepB)
    .addNode("step_c", stepC)
    .addNode("owner_gate", ownerGate)
    .addNode("owner_decision", ownerDecision)
    .addNode("step_d", stepD)
    .addEdge(START, "load_state")
    .addEdge("load_state", "evidence_gate")
    .addConditionalEdges(
      "evidence_gate",
      (state) => state.evidenceGateOutcome,
      {
        PASS: "authority_route",
        BLOCK: END,
        NOT_CHECKED: END,
      },
    )
    .addConditionalEdges(
      "authority_route",
      (state) => state.authorityOutcome,
      {
        AUTHORIZED: "step_a",
        BLOCK: END,
        NOT_CHECKED: END,
      },
    )
    .addEdge("step_a", "step_b")
    .addEdge("step_b", "step_c")
    .addEdge("step_c", "owner_gate")
    .addEdge("owner_gate", "owner_decision")
    .addConditionalEdges(
      "owner_decision",
      (state) => state.ownerDecisionOutcome,
      {
        CONTINUE: "step_d",
        NOT_REQUIRED: "step_d",
        STOP: END,
        INVALID: END,
        PENDING: END,
      },
    )
    .addEdge("step_d", END);
}

export function getInterruptValues(result: unknown): unknown[] {
  const interrupts = (result as {
    __interrupt__?: Array<{ value?: unknown }>;
  }).__interrupt__;

  if (!Array.isArray(interrupts)) return [];
  return interrupts.map((entry) => entry.value);
}
