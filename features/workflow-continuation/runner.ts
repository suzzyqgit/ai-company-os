import { pathToFileURL } from "node:url";
import { Command } from "@langchain/langgraph";
import {
  createWorkflowInput,
  type EvidenceStatus,
  type OwnerDecisionResponse,
} from "./contracts.ts";
import { createWorkflowRuntime, workflowConfig } from "./runtime.ts";
import { getInterruptValues, type WorkflowState } from "./workflow.ts";

type RunnerOperation = "start" | "recover" | "resume";

function parseArguments(argv: string[]) {
  const [operationValue, ...rest] = argv;

  if (!["start", "recover", "resume"].includes(operationValue ?? "")) {
    throw new Error("usage: workflow:poc <start|recover|resume> [options]");
  }

  const flags = new Map<string, string>();
  const booleans = new Set<string>();

  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith("--")) {
      throw new Error(`unexpected_argument:${key}`);
    }

    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      booleans.add(key.slice(2));
      continue;
    }

    flags.set(key.slice(2), next);
    index += 1;
  }

  return {
    operation: operationValue as RunnerOperation,
    get(name: string, fallback?: string) {
      return flags.get(name) ?? fallback;
    },
    has(name: string) {
      return booleans.has(name);
    },
  };
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing_required_option:${name}`);
  return value;
}

function toOutput(
  operation: RunnerOperation,
  threadId: string,
  result: WorkflowState & { __interrupt__?: unknown },
) {
  const interrupts = getInterruptValues(result);

  return {
    operation,
    threadId,
    outcome: interrupts.length > 0 ? "INTERRUPTED" : result.workflowStatus,
    workflowStatus: result.workflowStatus,
    evidenceGateOutcome: result.evidenceGateOutcome,
    authorityOutcome: result.authorityOutcome,
    decisionAuthority: result.decisionAuthority,
    ownerDecisionOutcome: result.ownerDecisionOutcome,
    stepHistory: result.stepHistory,
    eventHistory: result.eventHistory,
    sideEffectDisposition: result.sideEffectDisposition,
    routineOwnerPromptCount: result.routineOwnerPromptCount,
    ownerDecisionResponseCount: result.ownerDecisionResponseCount,
    blockReason: result.blockReason,
    runtimeBoundary: result.runtimeBoundary,
    interrupts,
  };
}

export async function run(argv: string[]): Promise<Record<string, unknown>> {
  const args = parseArguments(argv);
  const threadId = required(args.get("thread"), "thread");
  const databaseUrl = required(
    args.get("database-url", process.env.DATABASE_URL),
    "database-url",
  );
  const runtime = await createWorkflowRuntime(databaseUrl);
  const config = workflowConfig(threadId);

  try {
    if (args.operation === "start") {
      const input = createWorkflowInput({
        threadId,
        workflowRunId: args.get("workflow-run", threadId),
        evidenceStatus: args.get(
          "evidence-status",
          "CONFIRMED",
        ) as EvidenceStatus,
        evidenceReference: args.get(
          "evidence-reference",
          `ODL-EVIDENCE-${threadId}`,
        ),
        routeKey: args.get("route"),
        actorRole: args.get("actor-role"),
        requestedTransition: args.get("transition"),
        failStepBOnce: args.has("fail-step-b-once"),
      });
      const result = await runtime.graph.invoke(input, config);
      return toOutput(args.operation, threadId, result);
    }

    if (args.operation === "recover") {
      const result = await runtime.graph.invoke(null, config);
      return toOutput(args.operation, threadId, result);
    }

    const response: OwnerDecisionResponse = {
      actor: args.get("actor", "OWNER") ?? "OWNER",
      decision: args.get("decision", "CONTINUE") ?? "CONTINUE",
      decisionReference:
        args.get("decision-reference", `OWNER-DECISION-${threadId}`) ??
        `OWNER-DECISION-${threadId}`,
    };
    const result = await runtime.graph.invoke(
      new Command({ resume: response }),
      config,
    );
    return toOutput(args.operation, threadId, result);
  } finally {
    await runtime.close();
  }
}

async function main() {
  try {
    const output = await run(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    process.stderr.write(
      `${JSON.stringify({
        outcome: "ERROR",
        error: {
          name: normalized.name,
          message: normalized.message,
        },
      })}\n`,
    );
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (executedPath === import.meta.url) {
  await main();
}
