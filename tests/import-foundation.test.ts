import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  buildPhase1AImportOutput,
  buildNoteAccessSnapshotImportOutput,
  buildSourceMetadata,
  getSnapshotFeed,
  importOutputSchemaVersion,
  persistImportOutput,
  sourceMetadataStandardVersion,
  validateImportOutput,
  validateSourceMetadata,
  type ImportOutput,
  type SourceMetadata,
} from "../features/imports/import-pipeline/index.ts";

const execFileAsync = promisify(execFile);

let prisma: PrismaClient;
let cleanupDatabase: () => Promise<void>;

async function createPrismaClient() {
  const directory = await mkdtemp(join(process.env.TMPDIR ?? "/tmp", "import-foundation-"));
  const databaseUrl = `file:${join(directory, "test.db")}`;

  await execFileAsync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      RUST_LOG: "debug",
    },
  });

  return {
    prisma: new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    }),
    cleanup: async () => {
      await rm(directory, {
        recursive: true,
        force: true,
      });
    },
  };
}

test.before(async () => {
  const client = await createPrismaClient();
  prisma = client.prisma;
  cleanupDatabase = client.cleanup;
});

test.after(async () => {
  if (!prisma || !cleanupDatabase) {
    return;
  }

  await prisma.$disconnect();
  await cleanupDatabase();
});

test.beforeEach(async () => {
  if (!prisma) {
    return;
  }

  await prisma.snapshot.deleteMany();
  await prisma.importSource.deleteMany();
  await prisma.importRun.deleteMany();
  await prisma.article.deleteMany();
});

const inspection = {
  sourceHash: "b".repeat(64),
  fileName: "source.png",
  fileSizeBytes: 1024,
  mime: "image/png",
  fileSignature: "89504E47",
  image: {
    width: 1200,
    height: 800,
  },
};

function createSourceMetadata(overrides: Partial<SourceMetadata> = {}) {
  return {
    ...buildSourceMetadata({
      inspection,
      sourceType: "note_access_dashboard",
      parserVersion: "test-parser-v1",
      confidence: 0.95,
      importedAt: "2026-07-23T12:00:00.000Z",
      importedBy: "test-runner",
    }),
    ...overrides,
  };
}

function createImportOutput(overrides: Partial<ImportOutput> = {}): ImportOutput {
  const base: ImportOutput = {
    schemaVersion: importOutputSchemaVersion,
    importRun: {
      status: "completed",
      startedAt: "2026-07-23T12:00:00.000Z",
      completedAt: "2026-07-23T12:00:01.000Z",
      importedAt: "2026-07-23T12:00:00.000Z",
      importedBy: "test-runner",
      pipelineVersion: "test-parser-v1",
      summary: {
        snapshotCount: 1,
      },
      error: null,
    },
    importSource: createSourceMetadata(),
    classification: {
      sourceKind: "note_access_dashboard",
      snapshotType: "WEEKLY",
      confidence: 0.95,
      evidence: {
        matchedKeywords: ["アクセス状況", "全体ビュー", "コメント", "スキ"],
        rejectedKeywords: [],
        layoutSignals: ["access_dashboard_summary"],
      },
      reviewRequired: false,
      rejectionReason: null,
    },
    extraction: {
      periodStart: "2026-07-09",
      periodEnd: "2026-07-15",
      pv: 492,
      comments: 0,
      likes: 10,
    },
    normalizedRecords: [],
    validation: {
      ok: true,
      issues: [],
    },
    snapshots: [
      {
        domain: "note",
        snapshotType: "WEEKLY",
        periodStart: "2026-07-09",
        periodEnd: "2026-07-15",
        observedAt: "2026-07-15",
        confidence: 0.95,
        status: "approved",
        validationStatus: "passed",
        data: {
          pv: 492,
          comments: 0,
          likes: 10,
        },
        evidence: {
          sourceHash: "b".repeat(64),
        },
        pv: 492,
        comments: 0,
        likes: 10,
      },
    ],
    evidence: {
      parser: "test-parser-v1",
    },
    errors: [],
    warnings: [],
  };

  return {
    ...base,
    ...overrides,
  };
}

test("validates Source Metadata Standard v1.0", () => {
  const metadata = createSourceMetadata();
  const result = validateSourceMetadata(metadata);

  assert.equal(metadata.schemaVersion, sourceMetadataStandardVersion);
  assert.equal(result.ok, true);
});

test("validates Import Output Schema v1.0", () => {
  const output = createImportOutput();
  const result = validateImportOutput(output);

  assert.equal(output.schemaVersion, importOutputSchemaVersion);
  assert.equal(result.ok, true);
});

test("persists ImportRun, ImportSource, and Snapshot with traceability", async () => {
  const result = await persistImportOutput({
    prisma,
    output: createImportOutput(),
  });
  const run = await prisma.importRun.findUnique({
    where: {
      id: result.importRunId,
    },
    include: {
      sources: true,
      snapshots: true,
    },
  });

  assert.equal(run?.status, "completed");
  assert.equal(run?.sources.length, 1);
  assert.equal(run?.sources[0].sourceHash, "b".repeat(64));
  assert.equal(run?.snapshots.length, 1);
  assert.equal(run?.snapshots[0].pv, 492);
  assert.equal(run?.snapshots[0].comments, 0);
  assert.equal(run?.snapshots[0].likes, 10);
  assert.equal(run?.snapshots[0].importSourceId, run?.sources[0].id);
});

test("persists failed runs for audit without approved snapshots", async () => {
  const result = await persistImportOutput({
    prisma,
    output: createImportOutput({
      importRun: {
        ...createImportOutput().importRun,
        status: "failed",
        error: "validation_failed",
      },
      validation: {
        ok: false,
        issues: ["period_unresolved"],
      },
      snapshots: [],
      errors: ["period_unresolved"],
    }),
  });
  const run = await prisma.importRun.findUnique({
    where: {
      id: result.importRunId,
    },
    include: {
      sources: true,
      snapshots: true,
    },
  });

  assert.equal(run?.status, "failed");
  assert.equal(run?.error, "validation_failed");
  assert.equal(run?.sources.length, 1);
  assert.equal(run?.snapshots.length, 0);
});

test("rejects an approved snapshot when the pipeline validation failed", () => {
  const output = createImportOutput({
    validation: {
      ok: false,
      issues: ["period_unresolved"],
    },
  });
  const result = validateImportOutput(output);

  assert.equal(result.ok, false);
  assert.ok(result.issues.includes("snapshot_0_failed_validation_must_not_be_approved"));
});

test("keeps null and unresolved snapshot values instead of coercing to zero", async () => {
  const output = createImportOutput({
    importRun: {
      ...createImportOutput().importRun,
      status: "review_required",
    },
    snapshots: [
      {
        ...createImportOutput().snapshots[0],
        status: "review_required",
        validationStatus: "passed_with_warnings",
        data: {
          pv: null,
          comments: null,
          likes: null,
          unresolved: true,
        },
        pv: null,
        comments: null,
        likes: null,
      },
    ],
  });
  const result = await persistImportOutput({ prisma, output });
  const snapshot = await prisma.snapshot.findUnique({
    where: {
      id: result.snapshotIds[0],
    },
  });

  assert.equal(snapshot?.pv, null);
  assert.equal(snapshot?.comments, null);
  assert.equal(snapshot?.likes, null);
  assert.equal(snapshot?.status, "review_required");
});

test("does not convert UNKNOWN snapshot type to ALL_TIME", () => {
  const output = createImportOutput({
    snapshots: [
      {
        ...createImportOutput().snapshots[0],
        snapshotType: "UNKNOWN",
        status: "rejected",
        validationStatus: "failed",
      },
    ],
  });
  const result = validateImportOutput(output);

  assert.equal(result.ok, true);
  assert.equal(output.snapshots[0].snapshotType, "UNKNOWN");
});

test("does not update Article.pv for period snapshots", async () => {
  const article = await prisma.article.create({
    data: {
      title: "Anonymous article",
      price: 1000,
      pv: 9999,
      purchases: 0,
    },
  });
  await persistImportOutput({
    prisma,
    output: createImportOutput({
      snapshots: [
        {
          ...createImportOutput().snapshots[0],
          articleId: article.id,
          snapshotType: "WEEKLY",
          pv: 492,
        },
      ],
    }),
  });
  const current = await prisma.article.findUnique({
    where: {
      id: article.id,
    },
  });

  assert.equal(current?.pv, 9999);
});

test("marks duplicate SourceHash approved snapshots as review_required while preserving audit reruns", async () => {
  const first = await persistImportOutput({
    prisma,
    output: createImportOutput(),
  });
  const second = await persistImportOutput({
    prisma,
    output: createImportOutput(),
  });
  const secondSnapshot = await prisma.snapshot.findUnique({
    where: {
      id: second.snapshotIds[0],
    },
  });

  assert.equal(first.duplicateApprovedSnapshotCount, 0);
  assert.equal(second.duplicateApprovedSnapshotCount, 1);
  assert.equal(second.status, "review_required");
  assert.equal(secondSnapshot?.status, "review_required");
  assert.equal(await prisma.importRun.count(), 2);
  assert.equal(await prisma.importSource.count(), 2);
});

test("Snapshot Feed filters by status and returns stable newest-first order", async () => {
  await persistImportOutput({
    prisma,
    output: createImportOutput(),
  });
  await persistImportOutput({
    prisma,
    output: createImportOutput({
      importSource: createSourceMetadata({
        sourceHash: "c".repeat(64),
        sourceFile: "second.png",
      }),
      snapshots: [
        {
          ...createImportOutput().snapshots[0],
          observedAt: "2026-07-16",
          periodStart: "2026-07-10",
          periodEnd: "2026-07-16",
          data: {
            pv: 500,
            comments: 1,
            likes: 11,
          },
          pv: 500,
          comments: 1,
          likes: 11,
        },
      ],
    }),
  });
  const feed = await getSnapshotFeed({
    prisma,
    query: {
      domain: "note",
      status: "approved",
      limit: 10,
    },
  });

  assert.equal(feed.items.length, 2);
  assert.equal(feed.items[0].periodEnd, "2026-07-16T00:00:00.000Z");
  assert.equal(feed.items[0].source.sourceHash, "c".repeat(64));
  assert.equal(feed.nextCursor, null);
});

test("Phase 1A output connects classification results to the common contract", () => {
  const output = buildPhase1AImportOutput({
    inspection,
    classification: {
      sourceKind: "note_access_dashboard",
      snapshotType: "WEEKLY",
      confidence: 0.96,
      evidence: {
        matchedKeywords: ["アクセス状況"],
        rejectedKeywords: [],
        layoutSignals: ["access_dashboard_summary"],
      },
      reviewRequired: true,
      rejectionReason: null,
    },
    extraction: {
      activeTab: "週",
      periodLabel: "2026年7月9日 - 2026年7月15日",
      periodStart: "2026-07-09",
      periodEnd: "2026-07-15",
      pv: 492,
      comments: 0,
      likes: 10,
      evidence: ["period:2026年7月9日 - 2026年7月15日"],
    },
    validation: {
      ok: true,
      issues: [],
    },
    importedAt: "2026-07-23T12:00:00.000Z",
    importedBy: "test-runner",
    pipelineVersion: "test-parser-v1",
  });
  const result = validateImportOutput(output);

  assert.equal(result.ok, true);
  assert.equal(output.snapshots.length, 1);
  assert.equal(output.snapshots[0].status, "review_required");
});

test("Phase 1B persists a validated period snapshot as review required with traceability", async () => {
  const output = buildNoteAccessSnapshotImportOutput({
    inspection,
    ocrText: `
      note アクセス状況
      選択中: 週
      2026年7月9日 - 2026年7月15日
      492 0 10
      全体ビュー コメント スキ
    `,
    importedAt: "2026-07-23T12:00:00.000Z",
    importedBy: "test-runner",
    pipelineVersion: "note-import-pipeline-phase1b-v1",
  });
  const result = await persistImportOutput({ prisma, output });
  const run = await prisma.importRun.findUnique({
    where: { id: result.importRunId },
    include: { sources: true, snapshots: true },
  });

  assert.equal(result.status, "review_required");
  assert.equal(run?.sources.length, 1);
  assert.equal(run?.snapshots.length, 1);
  assert.equal(run?.snapshots[0].snapshotType, "WEEKLY");
  assert.equal(run?.snapshots[0].status, "review_required");
  assert.equal(run?.snapshots[0].pv, 492);
  assert.equal(run?.snapshots[0].comments, 0);
  assert.equal(run?.snapshots[0].likes, 10);
  assert.equal(run?.snapshots[0].importSourceId, run?.sources[0].id);
});

test("Phase 1B persists an article-list audit run but refuses a Snapshot", async () => {
  const output = buildNoteAccessSnapshotImportOutput({
    inspection: {
      ...inspection,
      sourceHash: "d".repeat(64),
      fileName: "article-list.png",
    },
    ocrText: `
      記事一覧
      タイトル 価格 購入数 購入率 更新日
      匿名記事 ¥980 2 1.2% 2026-07-15
    `,
    importedAt: "2026-07-23T12:00:00.000Z",
    importedBy: "test-runner",
    pipelineVersion: "note-import-pipeline-phase1b-v1",
  });
  const result = await persistImportOutput({ prisma, output });
  const run = await prisma.importRun.findUnique({
    where: { id: result.importRunId },
    include: { sources: true, snapshots: true },
  });

  assert.equal(result.status, "failed");
  assert.equal(run?.sources[0].sourceType, "note_article_list");
  assert.equal(run?.snapshots.length, 0);
});

test("foundation fixtures do not retain personal identifiers", () => {
  const fixtureText = JSON.stringify(createImportOutput());

  assert.doesNotMatch(fixtureText, /buyer|purchaser|customer|transaction-[A-Za-z0-9]/i);
  assert.doesNotMatch(fixtureText, /購入者名|取引ID/);
});
