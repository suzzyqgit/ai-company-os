import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import test from "node:test";
import { Command } from "@langchain/langgraph";
import {
  DeterministicAuthorityRouter,
  FixtureEvidenceGateAdapter,
} from "../features/workflow-continuation/adapters.ts";
import {
  OWNER_DECISION_ROUTE,
  ROUTINE_ONLY_ROUTE,
  ROUTINE_TRANSITION,
  createWorkflowInput,
  type OwnerDecisionResponse,
} from "../features/workflow-continuation/contracts.ts";
import {
  createWorkflowRuntime,
  workflowConfig,
} from "../features/workflow-continuation/runtime.ts";
import {
  WorkflowFixtureFailure,
  getInterruptValues,
  type WorkflowState,
} from "../features/workflow-continuation/workflow.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
const runnerPath = join(
  repositoryRoot,
  "features/workflow-continuation/runner.ts",
);
const requireForTest = createRequire(import.meta.url);

interface BetterSqliteDatabase {
  exec(sql: string): void;
  close(): void;
}

const BetterSqlite = requireForTest("better-sqlite3") as new (
  path: string,
) => BetterSqliteDatabase;

let testRoot = "";
let templateDatabasePath = "";
let databaseSequence = 0;

test.before(async () => {
  testRoot = await mkdtemp(join(tmpdir(), "kavora-workflow-poc-"));
  templateDatabasePath = join(testRoot, "template.db");
  const database = new BetterSqlite(templateDatabasePath);
  const migrationDirectories = await readdir(
    join(repositoryRoot, "prisma/migrations"),
    { withFileTypes: true },
  );

  for (const migrationDirectory of migrationDirectories
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    const migrationSql = await readFile(
      join(
        repositoryRoot,
        "prisma/migrations",
        migrationDirectory,
        "migration.sql",
      ),
      "utf8",
    );
    database.exec(migrationSql);
  }

  database.close();
});

test.after(async () => {
  if (!testRoot) return;
  await rm(testRoot, { recursive: true, force: true });
});

async function createTestDatabase(label: string) {
  databaseSequence += 1;
  const directory = join(
    testRoot,
    `${String(databaseSequence).padStart(2, "0")}-${label.replace(/[^a-z0-9-]/gi, "-")}`,
  );
  await mkdir(directory, { recursive: true });
  const databasePath = join(directory, "workflow.db");
  await copyFile(templateDatabasePath, databasePath);
  return {
    databasePath,
    databaseUrl: `file:${databasePath}`,
  };
}

function asWorkflowState(result: unknown): WorkflowState & {
  __interrupt__?: unknown;
} {
  return result as WorkflowState & { __interrupt__?: unknown };
}

function ownerContinue(threadId: string): OwnerDecisionResponse {
  return {
    actor: "OWNER",
    decision: "CONTINUE",
    decisionReference: `OWNER-DECISION-${threadId}`,
  };
}

async function invokeInitial({
  label,
  threadId,
  input = createWorkflowInput({ threadId }),
}: {
  label: string;
  threadId: string;
  input?: ReturnType<typeof createWorkflowInput>;
}) {
  const database = await createTestDatabase(label);
  const runtime = await createWorkflowRuntime(database.databaseUrl);
  const config = workflowConfig(threadId);
  const result = asWorkflowState(await runtime.graph.invoke(input, config));
  return { database, runtime, config, result };
}

async function runCli(
  databaseUrl: string,
  operation: "start" | "recover" | "resume",
  args: string[],
) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      runnerPath,
      operation,
      "--database-url",
      databaseUrl,
      ...args,
    ],
    {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
    },
  );

  return JSON.parse(stdout.trim()) as Record<string, unknown>;
}

async function getOperationalDataLayerCounts(
  runtime: Awaited<ReturnType<typeof createWorkflowRuntime>>,
) {
  return {
    importRuns: await runtime.prisma.importRun.count(),
    canonicalSalesRecords: await runtime.prisma.canonicalSalesRecord.count(),
    sales: await runtime.prisma.sale.count(),
    saleItems: await runtime.prisma.saleItem.count(),
    promotionRuns: await runtime.prisma.promotionRun.count(),
    snapshots: await runtime.prisma.snapshot.count(),
  };
}

test("AT-01 — persists workflow checkpoints durably in the existing SQLite database", async () => {
  const threadId = "at-01-durable-checkpoint";
  const context = await invokeInitial({ label: "at-01", threadId });

  try {
    const tables = await context.runtime.prisma.$queryRawUnsafe<
      Array<{ name: string }>
    >(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const tableNames = new Set(tables.map((row) => row.name));
    assert.ok(tableNames.has("checkpoints"));
    assert.ok(tableNames.has("writes"));
    assert.ok(tableNames.has("kavora_workflow_poc_side_effects"));

    const state = await context.runtime.graph.getState(context.config);
    assert.equal(state.config.configurable?.thread_id, threadId);
    assert.deepEqual(state.next, ["owner_gate"]);
    assert.equal(getInterruptValues(context.result).length, 1);
  } finally {
    await context.runtime.close();
  }
});

test("AT-02 — uses deterministic authority and evidence adapters without LLM delegation", () => {
  const router = new DeterministicAuthorityRouter();
  const evidenceGate = new FixtureEvidenceGateAdapter();

  assert.deepEqual(
    router.route({
      routeKey: OWNER_DECISION_ROUTE,
      actorRole: "CEO",
      requestedTransition: ROUTINE_TRANSITION,
    }),
    {
      outcome: "AUTHORIZED",
      reason: null,
      decisionAuthority: "OWNER_ONLY",
    },
  );
  assert.deepEqual(
    evidenceGate.evaluate(
      createWorkflowInput({ threadId: "at-02" }).evidence,
    ),
    {
      outcome: "PASS",
      reason: null,
      evidenceReference: "ODL-EVIDENCE-at-02",
    },
  );
});

test("AT-03 — executes Step A, B, and C with zero routine Owner prompts", async () => {
  const context = await invokeInitial({
    label: "at-03",
    threadId: "at-03-routine-continuation",
  });

  try {
    assert.deepEqual(context.result.stepHistory, ["STEP_A", "STEP_B", "STEP_C"]);
    assert.equal(context.result.routineOwnerPromptCount, 0);
    assert.equal(context.result.ownerDecisionResponseCount, 0);
    assert.equal(context.result.workflowStatus, "WAITING_OWNER");
  } finally {
    await context.runtime.close();
  }
});

test("AT-04 — interrupts only at the Owner-only decision gate after Step C", async () => {
  const threadId = "at-04-owner-interrupt";
  const context = await invokeInitial({ label: "at-04", threadId });

  try {
    const interrupts = getInterruptValues(context.result);
    assert.equal(interrupts.length, 1);
    assert.deepEqual(interrupts[0], {
      kind: "OWNER_ONLY_DECISION",
      threadId,
      workflowRunId: threadId,
      question: "Continue this bounded workflow to Step D?",
      allowedDecisions: ["CONTINUE", "STOP"],
    });
    assert.equal(context.result.decisionAuthority, "OWNER_ONLY");
    assert.equal(context.result.stepHistory.includes("STEP_D"), false);
  } finally {
    await context.runtime.close();
  }
});

test("AT-05 — one Owner response resumes the same thread and reaches Step D and END", async () => {
  const threadId = "at-05-owner-resume";
  const context = await invokeInitial({ label: "at-05", threadId });

  try {
    const resumed = asWorkflowState(
      await context.runtime.graph.invoke(
        new Command({ resume: ownerContinue(threadId) }),
        context.config,
      ),
    );
    const finalState = await context.runtime.graph.getState(context.config);

    assert.equal(resumed.threadId, threadId);
    assert.equal(resumed.workflowStatus, "ENDED");
    assert.deepEqual(resumed.stepHistory, [
      "STEP_A",
      "STEP_B",
      "STEP_C",
      "STEP_D",
    ]);
    assert.equal(resumed.ownerDecisionResponseCount, 1);
    assert.equal(resumed.routineOwnerPromptCount, 0);
    assert.equal(getInterruptValues(resumed).length, 0);
    assert.deepEqual(finalState.next, []);
  } finally {
    await context.runtime.close();
  }
});

test("AT-06 — resumes from the durable checkpoint after a process restart", async () => {
  const database = await createTestDatabase("at-06");
  const threadId = "at-06-process-restart";
  const started = await runCli(database.databaseUrl, "start", [
    "--thread",
    threadId,
  ]);
  const resumed = await runCli(database.databaseUrl, "resume", [
    "--thread",
    threadId,
    "--actor",
    "OWNER",
    "--decision",
    "CONTINUE",
    "--decision-reference",
    "OWNER-DECISION-AT-06",
  ]);

  assert.equal(started.outcome, "INTERRUPTED");
  assert.deepEqual(started.stepHistory, ["STEP_A", "STEP_B", "STEP_C"]);
  assert.equal(resumed.outcome, "ENDED");
  assert.equal(resumed.threadId, threadId);
  assert.equal(resumed.ownerDecisionResponseCount, 1);
  assert.deepEqual(resumed.stepHistory, [
    "STEP_A",
    "STEP_B",
    "STEP_C",
    "STEP_D",
  ]);
});

test("AT-07 — fails closed on an unauthorized transition", async () => {
  const threadId = "at-07-unauthorized-transition";
  const context = await invokeInitial({
    label: "at-07",
    threadId,
    input: createWorkflowInput({
      threadId,
      requestedTransition: "UNAUTHORIZED_TRANSITION",
    }),
  });

  try {
    assert.equal(context.result.evidenceGateOutcome, "PASS");
    assert.equal(context.result.authorityOutcome, "BLOCK");
    assert.equal(context.result.blockReason, "transition_not_authorized");
    assert.equal(context.result.workflowStatus, "BLOCKED");
    assert.deepEqual(context.result.stepHistory, []);
    assert.equal(getInterruptValues(context.result).length, 0);
  } finally {
    await context.runtime.close();
  }
});

test("AT-08 — blocks before execution when Evidence is missing", async () => {
  const threadId = "at-08-missing-evidence";
  const context = await invokeInitial({
    label: "at-08",
    threadId,
    input: createWorkflowInput({
      threadId,
      evidenceStatus: "MISSING",
      evidenceReference: "",
    }),
  });

  try {
    assert.equal(context.result.evidenceGateOutcome, "BLOCK");
    assert.equal(context.result.blockReason, "evidence_missing");
    assert.equal(context.result.workflowStatus, "BLOCKED");
    assert.deepEqual(context.result.stepHistory, []);
    assert.equal(context.result.authorityOutcome, "NOT_CHECKED");
  } finally {
    await context.runtime.close();
  }
});

test("AT-09 — blocks before execution when Evidence is unverified", async () => {
  const threadId = "at-09-unverified-evidence";
  const context = await invokeInitial({
    label: "at-09",
    threadId,
    input: createWorkflowInput({
      threadId,
      evidenceStatus: "UNVERIFIED",
    }),
  });

  try {
    assert.equal(context.result.evidenceGateOutcome, "BLOCK");
    assert.equal(context.result.blockReason, "evidence_unverified");
    assert.equal(context.result.workflowStatus, "BLOCKED");
    assert.deepEqual(context.result.stepHistory, []);
  } finally {
    await context.runtime.close();
  }
});

test("AT-10 — does not interrupt for a deterministic non-Owner decision route", async () => {
  const threadId = "at-10-no-owner-decision";
  const context = await invokeInitial({
    label: "at-10",
    threadId,
    input: createWorkflowInput({
      threadId,
      routeKey: ROUTINE_ONLY_ROUTE,
    }),
  });

  try {
    assert.equal(context.result.decisionAuthority, "CEO");
    assert.equal(context.result.ownerDecisionOutcome, "NOT_REQUIRED");
    assert.equal(context.result.workflowStatus, "ENDED");
    assert.equal(getInterruptValues(context.result).length, 0);
    assert.equal(context.result.ownerDecisionResponseCount, 0);
    assert.equal(context.result.routineOwnerPromptCount, 0);
    assert.deepEqual(context.result.stepHistory, [
      "STEP_A",
      "STEP_B",
      "STEP_C",
      "STEP_D",
    ]);
  } finally {
    await context.runtime.close();
  }
});

test("AT-11 — rejects a non-Owner response at the Owner-only gate", async () => {
  const threadId = "at-11-non-owner-response";
  const context = await invokeInitial({ label: "at-11", threadId });

  try {
    const resumed = asWorkflowState(
      await context.runtime.graph.invoke(
        new Command({
          resume: {
            actor: "CEO",
            decision: "CONTINUE",
            decisionReference: "CEO-RESPONSE-AT-11",
          },
        }),
        context.config,
      ),
    );

    assert.equal(resumed.ownerDecisionOutcome, "INVALID");
    assert.equal(resumed.workflowStatus, "BLOCKED");
    assert.equal(resumed.blockReason, "owner_decision_invalid_or_unauthorized");
    assert.equal(resumed.stepHistory.includes("STEP_D"), false);
  } finally {
    await context.runtime.close();
  }
});

test("AT-12 — recovers from the last successful checkpoint after a failure and restart", async () => {
  const database = await createTestDatabase("at-12");
  const threadId = "at-12-failure-recovery";
  const config = workflowConfig(threadId);
  const firstRuntime = await createWorkflowRuntime(database.databaseUrl);

  try {
    await assert.rejects(
      () =>
        firstRuntime.graph.invoke(
          createWorkflowInput({ threadId, failStepBOnce: true }),
          config,
        ),
      (error: unknown) =>
        error instanceof WorkflowFixtureFailure &&
        error.message === "step_b_failure_after_side_effect",
    );
    const failedState = await firstRuntime.graph.getState(config);
    assert.deepEqual(failedState.next, ["step_b"]);
  } finally {
    await firstRuntime.close();
  }

  const restartedRuntime = await createWorkflowRuntime(database.databaseUrl);
  try {
    const recovered = asWorkflowState(
      await restartedRuntime.graph.invoke(null, config),
    );
    assert.equal(recovered.workflowStatus, "WAITING_OWNER");
    assert.deepEqual(recovered.stepHistory, ["STEP_A", "STEP_B", "STEP_C"]);
    assert.equal(recovered.sideEffectDisposition, "DUPLICATE");
    assert.equal(getInterruptValues(recovered).length, 1);
  } finally {
    await restartedRuntime.close();
  }
});

test("AT-13 — prevents a duplicate side effect when the failed step is retried", async () => {
  const database = await createTestDatabase("at-13");
  const threadId = "at-13-idempotency";
  const config = workflowConfig(threadId);
  const firstRuntime = await createWorkflowRuntime(database.databaseUrl);

  try {
    await assert.rejects(() =>
      firstRuntime.graph.invoke(
        createWorkflowInput({ threadId, failStepBOnce: true }),
        config,
      ),
    );
    assert.equal(
      await firstRuntime.sideEffects.countByKey(`${threadId}:STEP_B`),
      1,
    );
  } finally {
    await firstRuntime.close();
  }

  const restartedRuntime = await createWorkflowRuntime(database.databaseUrl);
  try {
    const recovered = asWorkflowState(
      await restartedRuntime.graph.invoke(null, config),
    );
    assert.equal(recovered.sideEffectDisposition, "DUPLICATE");
    assert.equal(
      await restartedRuntime.sideEffects.countByKey(`${threadId}:STEP_B`),
      1,
    );
  } finally {
    await restartedRuntime.close();
  }
});

test("AT-14 — preserves the ODL/checkpoint boundary and asserts no canonical business fact", async () => {
  const database = await createTestDatabase("at-14");
  const threadId = "at-14-odl-boundary";
  const runtime = await createWorkflowRuntime(database.databaseUrl);
  const config = workflowConfig(threadId);

  try {
    const before = await getOperationalDataLayerCounts(runtime);
    await runtime.graph.invoke(createWorkflowInput({ threadId }), config);
    const result = asWorkflowState(
      await runtime.graph.invoke(
        new Command({ resume: ownerContinue(threadId) }),
        config,
      ),
    );
    const after = await getOperationalDataLayerCounts(runtime);

    assert.deepEqual(after, before);
    assert.equal(result.runtimeBoundary, "WORKFLOW_RUNTIME_ONLY");
    assert.equal(result.workflowStatus, "ENDED");

    const prohibitedCanonicalFactKeys = new Set([
      "approved",
      "completed",
      "revenue",
      "payment",
      "executioncompleted",
    ]);
    for (const key of Object.keys(result)) {
      assert.equal(
        prohibitedCanonicalFactKeys.has(key.toLowerCase()),
        false,
        `checkpoint state must not assert canonical business fact: ${key}`,
      );
    }

    const checkpointRows = await runtime.prisma.$queryRawUnsafe<
      Array<{ count: bigint | number }>
    >(
      "SELECT COUNT(*) AS count FROM checkpoints WHERE thread_id = ?",
      threadId,
    );
    assert.ok(Number(checkpointRows[0]?.count ?? 0) > 0);
  } finally {
    await runtime.close();
  }
});
