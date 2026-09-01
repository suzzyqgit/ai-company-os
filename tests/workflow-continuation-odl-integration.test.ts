import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Command } from "@langchain/langgraph";
import {
  DeterministicAuthorityRouter,
  FixtureEvidenceGateAdapter,
} from "../features/workflow-continuation/adapters.ts";
import {
  OWNER_DECISION_ROUTE,
  ROUTINE_TRANSITION,
  createWorkflowInput,
  type OwnerDecisionResponse,
} from "../features/workflow-continuation/contracts.ts";
import {
  createReadOnlyOdlEvidenceWorkflowRuntime,
} from "../features/workflow-continuation/odl-evidence-adapter.ts";
import { workflowConfig } from "../features/workflow-continuation/runtime.ts";
import {
  getInterruptValues,
  type WorkflowState,
} from "../features/workflow-continuation/workflow.ts";

const repositoryRoot = process.cwd();
const requireForTest = createRequire(import.meta.url);
const adapterSourcePath = join(
  repositoryRoot,
  "features/workflow-continuation/odl-evidence-adapter.ts",
);

interface BetterSqliteDatabase {
  exec(sql: string): void;
  close(): void;
}

const BetterSqlite = requireForTest("better-sqlite3") as new (
  path: string,
) => BetterSqliteDatabase;

const canonicalOdlTables = [
  "Actor",
  "ActorRole",
  "AgentMessage",
  "AgentRegistry",
  "AiAnalysisRun",
  "Article",
  "ArticleAccessImportItem",
  "ArticleAccessImportRun",
  "ArticleDailyMetric",
  "AttachmentMetadata",
  "CanonicalSalesRecord",
  "CommunicationPolicy",
  "ContentGap",
  "Conversation",
  "ExtensionRegistry",
  "FreeArticleDraft",
  "FreeArticleIdea",
  "ImportRun",
  "ImportSource",
  "NoteSaleTransaction",
  "Permission",
  "Product",
  "PromotionRun",
  "RevenueTask",
  "Role",
  "RolePermission",
  "Sale",
  "SaleItem",
  "Snapshot",
  "TodayTaskCompletion",
] as const;

type IntegrationRuntime = Awaited<
  ReturnType<typeof createReadOnlyOdlEvidenceWorkflowRuntime>
>;

type CanonicalOdlSnapshot = Record<string, Array<Record<string, unknown>>>;

let testRoot = "";
let templateDatabasePath = "";
let databaseSequence = 0;

test.before(async () => {
  testRoot = await mkdtemp(join(tmpdir(), "kavora-odl-evidence-integration-"));
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

async function seedOdlEvidence(runtime: IntegrationRuntime, label: string) {
  const importedAt = new Date("2026-09-01T00:00:00.000Z");
  const confirmedRun = await runtime.prisma.importRun.create({
    data: {
      status: "completed",
      completedAt: importedAt,
      importedAt,
      importedBy: "bounded-integration-test",
      pipelineVersion: "real-odl-evidence-v1",
    },
  });
  const confirmedSource = await runtime.prisma.importSource.create({
    data: {
      importRunId: confirmedRun.id,
      sourceType: "note_access_dashboard",
      sourceFile: `${label}-confirmed-source.png`,
      sourceHash: "c".repeat(64),
      parserVersion: "bounded-integration-v1",
      confidence: 1,
      metadataJson: JSON.stringify({ scope: "bounded_integration" }),
    },
  });
  const confirmedSnapshot = await runtime.prisma.snapshot.create({
    data: {
      importRunId: confirmedRun.id,
      importSourceId: confirmedSource.id,
      domain: "note",
      snapshotType: "WEEKLY",
      observedAt: importedAt,
      confidence: 1,
      status: "approved",
      validationStatus: "passed",
      dataJson: JSON.stringify({ pv: 1 }),
      evidenceJson: JSON.stringify({ sourceHash: confirmedSource.sourceHash }),
      pv: 1,
    },
  });

  const unverifiedRun = await runtime.prisma.importRun.create({
    data: {
      status: "review_required",
      importedAt,
      importedBy: "bounded-integration-test",
      pipelineVersion: "real-odl-evidence-v1",
    },
  });
  const unverifiedSource = await runtime.prisma.importSource.create({
    data: {
      importRunId: unverifiedRun.id,
      sourceType: "note_access_dashboard",
      sourceFile: `${label}-unverified-source.png`,
      sourceHash: "u".repeat(64),
      parserVersion: "bounded-integration-v1",
      confidence: 0.5,
      metadataJson: JSON.stringify({ scope: "bounded_integration" }),
    },
  });
  const unverifiedSnapshot = await runtime.prisma.snapshot.create({
    data: {
      importRunId: unverifiedRun.id,
      importSourceId: unverifiedSource.id,
      domain: "note",
      snapshotType: "WEEKLY",
      observedAt: importedAt,
      confidence: 0.5,
      status: "review_required",
      validationStatus: "passed",
      dataJson: JSON.stringify({ pv: 1 }),
      evidenceJson: JSON.stringify({ sourceHash: unverifiedSource.sourceHash }),
      pv: 1,
    },
  });

  return {
    confirmedEvidenceId: confirmedSnapshot.id,
    unverifiedEvidenceId: unverifiedSnapshot.id,
  };
}

async function createContext(label: string) {
  const database = await createTestDatabase(label);
  const runtime = await createReadOnlyOdlEvidenceWorkflowRuntime(
    database.databaseUrl,
  );
  const evidence = await seedOdlEvidence(runtime, label);
  return { database, runtime, evidence };
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

async function captureCanonicalOdl(
  runtime: IntegrationRuntime,
): Promise<CanonicalOdlSnapshot> {
  const snapshot: CanonicalOdlSnapshot = {};

  for (const table of canonicalOdlTables) {
    snapshot[table] = await runtime.prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(`SELECT * FROM "${table}" ORDER BY rowid`);
  }

  return snapshot;
}

function canonicalOdlHash(snapshot: CanonicalOdlSnapshot) {
  const serialized = JSON.stringify(snapshot, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function canonicalOdlCounts(snapshot: CanonicalOdlSnapshot) {
  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([, rows]) => rows.length > 0)
      .map(([table, rows]) => [table, rows.length]),
  );
}

test("BI-01 — only Confirmed Evidence resolved from the real ODL passes", async () => {
  const context = await createContext("bi-01");
  const threadId = "bi-01-confirmed-real-evidence";

  try {
    const result = asWorkflowState(
      await context.runtime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: context.evidence.confirmedEvidenceId,
          evidenceStatus: "MISSING",
        }),
        workflowConfig(threadId),
      ),
    );

    assert.equal(result.evidence.status, "CONFIRMED");
    assert.equal(result.evidenceGateOutcome, "PASS");
    assert.equal(
      result.verifiedEvidenceReference,
      context.evidence.confirmedEvidenceId,
    );
  } finally {
    await context.runtime.close();
  }
});

test("BI-02 — Missing Evidence blocks before workflow execution", async () => {
  const context = await createContext("bi-02");
  const threadId = "bi-02-missing-evidence";

  try {
    const result = asWorkflowState(
      await context.runtime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: "",
          evidenceStatus: "CONFIRMED",
        }),
        workflowConfig(threadId),
      ),
    );

    assert.equal(result.evidenceGateOutcome, "BLOCK");
    assert.equal(result.blockReason, "evidence_missing");
    assert.deepEqual(result.stepHistory, []);
  } finally {
    await context.runtime.close();
  }
});

test("BI-03 — Unverified Evidence in the real ODL blocks", async () => {
  const context = await createContext("bi-03");
  const threadId = "bi-03-unverified-evidence";

  try {
    const result = asWorkflowState(
      await context.runtime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: context.evidence.unverifiedEvidenceId,
          evidenceStatus: "UNVERIFIED",
        }),
        workflowConfig(threadId),
      ),
    );

    assert.equal(result.evidence.status, "UNVERIFIED");
    assert.equal(result.evidenceGateOutcome, "BLOCK");
    assert.equal(result.blockReason, "evidence_unverified");
    assert.deepEqual(result.stepHistory, []);
  } finally {
    await context.runtime.close();
  }
});

test("BI-04 — a nonexistent Evidence ID blocks", async () => {
  const context = await createContext("bi-04");
  const threadId = "bi-04-nonexistent-evidence";

  try {
    const result = asWorkflowState(
      await context.runtime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: "snapshot-does-not-exist",
          evidenceStatus: "CONFIRMED",
        }),
        workflowConfig(threadId),
      ),
    );

    assert.equal(result.evidence.status, "MISSING");
    assert.equal(result.evidenceGateOutcome, "BLOCK");
    assert.equal(result.blockReason, "evidence_missing");
  } finally {
    await context.runtime.close();
  }
});

test("BI-05 — a caller cannot self-declare CONFIRMED to bypass the ODL", async () => {
  const context = await createContext("bi-05");
  const threadId = "bi-05-self-declared-confirmed";

  try {
    const input = createWorkflowInput({
      threadId,
      evidenceReference: context.evidence.unverifiedEvidenceId,
      evidenceStatus: "CONFIRMED",
    });
    const result = asWorkflowState(
      await context.runtime.start(input, workflowConfig(threadId)),
    );

    assert.equal(input.evidence.status, "CONFIRMED");
    assert.equal(result.evidence.status, "UNVERIFIED");
    assert.equal(result.evidenceGateOutcome, "BLOCK");
    assert.deepEqual(result.stepHistory, []);
  } finally {
    await context.runtime.close();
  }
});

test("BI-06 — the real ODL Evidence Adapter performs no write", async () => {
  const context = await createContext("bi-06");

  try {
    const before = await captureCanonicalOdl(context.runtime);
    const resolved = await context.runtime.evidenceAdapter.resolve({
      reference: context.evidence.confirmedEvidenceId,
      callerClaimedStatus: "UNVERIFIED",
    });
    const after = await captureCanonicalOdl(context.runtime);
    const adapterSource = await readFile(adapterSourcePath, "utf8");

    assert.equal(resolved.status, "CONFIRMED");
    assert.deepEqual(after, before);
    assert.match(adapterSource, /snapshot\.findUnique\(/);
    assert.equal(
      /\.(create|createMany|update|updateMany|upsert|delete|deleteMany|\$executeRaw|\$executeRawUnsafe)\s*\(/.test(
        adapterSource,
      ),
      false,
    );
  } finally {
    await context.runtime.close();
  }
});

test("BI-07 — canonical ODL records are unchanged before and after execution", async (t) => {
  const context = await createContext("bi-07");
  const threadId = "bi-07-canonical-odl-unchanged";
  const config = workflowConfig(threadId);

  try {
    const before = await captureCanonicalOdl(context.runtime);
    const started = asWorkflowState(
      await context.runtime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: context.evidence.confirmedEvidenceId,
        }),
        config,
      ),
    );
    assert.equal(started.workflowStatus, "WAITING_OWNER");
    await context.runtime.graph.invoke(
      new Command({ resume: ownerContinue(threadId) }),
      config,
    );
    const after = await captureCanonicalOdl(context.runtime);
    const beforeHash = canonicalOdlHash(before);
    const afterHash = canonicalOdlHash(after);

    assert.deepEqual(after, before);
    assert.equal(afterHash, beforeHash);
    t.diagnostic(
      `ODL before/after counts=${JSON.stringify(canonicalOdlCounts(before))} sha256=${beforeHash}`,
    );
  } finally {
    await context.runtime.close();
  }
});

test("BI-08 — Confirmed real Evidence runs Step A through C with zero routine Owner prompts", async () => {
  const context = await createContext("bi-08");
  const threadId = "bi-08-routine-owner-prompt-zero";

  try {
    const result = asWorkflowState(
      await context.runtime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: context.evidence.confirmedEvidenceId,
        }),
        workflowConfig(threadId),
      ),
    );

    assert.deepEqual(result.stepHistory, ["STEP_A", "STEP_B", "STEP_C"]);
    assert.equal(result.routineOwnerPromptCount, 0);
    assert.equal(result.ownerDecisionResponseCount, 0);
  } finally {
    await context.runtime.close();
  }
});

test("BI-09 — Confirmed real Evidence stops at the Owner-only Gate", async () => {
  const context = await createContext("bi-09");
  const threadId = "bi-09-owner-only-gate";

  try {
    const result = asWorkflowState(
      await context.runtime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: context.evidence.confirmedEvidenceId,
        }),
        workflowConfig(threadId),
      ),
    );

    assert.equal(result.workflowStatus, "WAITING_OWNER");
    assert.equal(result.decisionAuthority, "OWNER_ONLY");
    assert.equal(getInterruptValues(result).length, 1);
    assert.equal(result.stepHistory.includes("STEP_D"), false);
  } finally {
    await context.runtime.close();
  }
});

test("BI-10 — restart recovers the same Evidence reference and thread", async () => {
  const database = await createTestDatabase("bi-10");
  const firstRuntime = await createReadOnlyOdlEvidenceWorkflowRuntime(
    database.databaseUrl,
  );
  const evidence = await seedOdlEvidence(firstRuntime, "bi-10");
  const threadId = "bi-10-restart-recovery";
  const config = workflowConfig(threadId);
  let checkedAt = "";

  try {
    const started = asWorkflowState(
      await firstRuntime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: evidence.confirmedEvidenceId,
        }),
        config,
      ),
    );
    checkedAt = started.evidence.checkedAt;
    assert.equal(started.workflowStatus, "WAITING_OWNER");
  } finally {
    await firstRuntime.close();
  }

  const restartedRuntime = await createReadOnlyOdlEvidenceWorkflowRuntime(
    database.databaseUrl,
  );
  try {
    const recoveredState = await restartedRuntime.graph.getState(config);
    const recoveredValues = recoveredState.values as WorkflowState;

    assert.equal(recoveredValues.threadId, threadId);
    assert.equal(recoveredValues.evidence.reference, evidence.confirmedEvidenceId);
    assert.equal(recoveredValues.evidence.checkedAt, checkedAt);
    assert.deepEqual(recoveredState.next, ["owner_gate"]);

    const resumed = asWorkflowState(
      await restartedRuntime.graph.invoke(
        new Command({ resume: ownerContinue(threadId) }),
        config,
      ),
    );
    assert.equal(resumed.threadId, threadId);
    assert.equal(resumed.evidence.reference, evidence.confirmedEvidenceId);
    assert.equal(resumed.workflowStatus, "ENDED");
  } finally {
    await restartedRuntime.close();
  }
});

test("BI-11 — Role Routing and Authority Policy remain unchanged", () => {
  const router = new DeterministicAuthorityRouter();
  const gate = new FixtureEvidenceGateAdapter();

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
    router.route({
      routeKey: OWNER_DECISION_ROUTE,
      actorRole: "CMO",
      requestedTransition: ROUTINE_TRANSITION,
    }),
    {
      outcome: "BLOCK",
      reason: "actor_role_not_authorized",
      decisionAuthority: "UNRESOLVED",
    },
  );
  assert.ok(gate instanceof FixtureEvidenceGateAdapter);
});

test("BI-12 — Integration PASS is not Production Approval", async () => {
  const context = await createContext("bi-12");
  const threadId = "bi-12-not-production-approval";

  try {
    const result = asWorkflowState(
      await context.runtime.start(
        createWorkflowInput({
          threadId,
          evidenceReference: context.evidence.confirmedEvidenceId,
        }),
        workflowConfig(threadId),
      ),
    );

    assert.equal(result.evidenceGateOutcome, "PASS");
    assert.equal(result.workflowStatus, "WAITING_OWNER");
    assert.equal(result.runtimeBoundary, "WORKFLOW_RUNTIME_ONLY");
    assert.equal(result.stepHistory.includes("STEP_D"), false);

    const prohibitedCanonicalFactKeys = new Set([
      "approved",
      "completed",
      "revenue",
      "payment",
      "executioncompleted",
      "productionapproval",
    ]);
    for (const key of Object.keys(result)) {
      assert.equal(prohibitedCanonicalFactKeys.has(key.toLowerCase()), false);
    }
  } finally {
    await context.runtime.close();
  }
});
