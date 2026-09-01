export const WORKFLOW_SCHEMA_VERSION =
  "kavora-workflow-continuation-poc-v1" as const;

export const OWNER_DECISION_ROUTE =
  "CEO_ROUTINE_WITH_OWNER_DECISION" as const;

export const ROUTINE_ONLY_ROUTE = "CEO_ROUTINE_NO_OWNER_DECISION" as const;

export const ROUTINE_TRANSITION = "RUN_BOUNDED_ROUTINE_SEQUENCE" as const;

export type EvidenceStatus = "CONFIRMED" | "MISSING" | "UNVERIFIED";

export type EvidenceGateOutcome = "NOT_CHECKED" | "PASS" | "BLOCK";

export type AuthorityOutcome = "NOT_CHECKED" | "AUTHORIZED" | "BLOCK";

export type DecisionAuthority = "OWNER_ONLY" | "CEO" | "UNRESOLVED";

export type OwnerDecision = "CONTINUE" | "STOP";

export type OwnerDecisionOutcome =
  | "PENDING"
  | "CONTINUE"
  | "STOP"
  | "NOT_REQUIRED"
  | "INVALID";

export type WorkflowStatus =
  | "READY"
  | "RUNNING"
  | "WAITING_OWNER"
  | "BLOCKED"
  | "OWNER_STOPPED"
  | "ENDED";

export type WorkflowStep = "STEP_A" | "STEP_B" | "STEP_C" | "STEP_D";

export type SideEffectDisposition =
  | "NOT_ATTEMPTED"
  | "APPLIED"
  | "DUPLICATE";

export interface EvidenceFixture {
  reference: string;
  status: EvidenceStatus;
  source: "OPERATIONAL_DATA_LAYER_ADAPTER_FIXTURE";
  checkedAt: string;
}

export interface AuthorityFixture {
  routeKey: string;
  actorRole: string;
  requestedTransition: string;
}

export interface OwnerDecisionResponse {
  actor: string;
  decision: string;
  decisionReference: string;
}

export interface OwnerInterruptPayload {
  kind: "OWNER_ONLY_DECISION";
  threadId: string;
  workflowRunId: string;
  question: string;
  allowedDecisions: readonly OwnerDecision[];
}

export interface WorkflowInput {
  workflowSchemaVersion: typeof WORKFLOW_SCHEMA_VERSION;
  workflowRunId: string;
  threadId: string;
  evidence: EvidenceFixture;
  authorityFixture: AuthorityFixture;
  failStepBOnce: boolean;
}

export interface CreateWorkflowInputOptions {
  threadId: string;
  workflowRunId?: string;
  evidenceStatus?: EvidenceStatus;
  evidenceReference?: string;
  routeKey?: string;
  actorRole?: string;
  requestedTransition?: string;
  failStepBOnce?: boolean;
}

export function createWorkflowInput({
  threadId,
  workflowRunId = threadId,
  evidenceStatus = "CONFIRMED",
  evidenceReference = `ODL-EVIDENCE-${threadId}`,
  routeKey = OWNER_DECISION_ROUTE,
  actorRole = "CEO",
  requestedTransition = ROUTINE_TRANSITION,
  failStepBOnce = false,
}: CreateWorkflowInputOptions): WorkflowInput {
  return {
    workflowSchemaVersion: WORKFLOW_SCHEMA_VERSION,
    workflowRunId,
    threadId,
    evidence: {
      reference: evidenceReference,
      status: evidenceStatus,
      source: "OPERATIONAL_DATA_LAYER_ADAPTER_FIXTURE",
      checkedAt: "2026-09-01T00:00:00.000Z",
    },
    authorityFixture: {
      routeKey,
      actorRole,
      requestedTransition,
    },
    failStepBOnce,
  };
}
