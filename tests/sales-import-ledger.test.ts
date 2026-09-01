import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { ImportApprovalStatus, PrismaClient } from "@prisma/client";
import {
  buildSalesBusinessKey,
  getApprovedSalesImportRecords,
  persistSalesImportLedger,
  transitionSalesImportApproval,
  type CanonicalSale,
} from "../features/imports/import-pipeline/index.ts";

const execFileAsync = promisify(execFile);
let prisma: PrismaClient;
let cleanupDatabase: () => Promise<void>;

const sale: CanonicalSale = {
  saleDate: "2026-07-15T09:00:00+09:00",
  productName: "匿名商品",
  quantity: 1,
  grossAmount: 1000,
  netAmount: 909,
  currency: "JPY",
  platform: "note",
  source: "note-sales-csv:v1",
  confidence: 0.98,
};

async function createPrismaClient() {
  const directory = await mkdtemp(join(process.env.TMPDIR ?? "/tmp", "sales-ledger-"));
  const databasePath = join(directory, "test.db");
  const databaseUrl = `file:${databasePath}`;
  const migrationDirectories = await readdir(
    join(process.cwd(), "prisma/migrations"),
    { withFileTypes: true },
  );

  for (const migrationDirectory of migrationDirectories
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    await execFileAsync(
      "sqlite3",
      [databasePath, `.read ${join(process.cwd(), "prisma/migrations", migrationDirectory, "migration.sql")}`],
      {
        cwd: process.cwd(),
      },
    );
  }

  return {
    prisma: new PrismaClient({ datasources: { db: { url: databaseUrl } } }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

async function createTraceability() {
  const run = await prisma.importRun.create({
    data: {
      status: "review_required",
      importedAt: new Date("2026-07-24T00:00:00.000Z"),
      importedBy: "test-runner",
      pipelineVersion: "sales-import-v1",
    },
  });
  const source = await prisma.importSource.create({
    data: {
      importRunId: run.id,
      sourceType: "note_sales_csv",
      sourceFile: "private-source.csv",
      sourceHash: "a".repeat(64),
      parserVersion: "note-sales-csv-v1",
      confidence: 0.98,
      metadataJson: "{}",
    },
  });
  return { run, source };
}

test.before(async () => {
  const client = await createPrismaClient();
  prisma = client.prisma;
  cleanupDatabase = client.cleanup;
});

test.after(async () => {
  if (!prisma || !cleanupDatabase) return;
  await prisma.$disconnect();
  await cleanupDatabase();
});

test.beforeEach(async () => {
  if (!prisma) return;
  await prisma.canonicalSalesRecord.deleteMany();
  await prisma.importSource.deleteMany();
  await prisma.importRun.deleteMany();
});

test("persists an Import Ledger record with complete audit traceability", async () => {
  const { run, source } = await createTraceability();
  const result = await persistSalesImportLedger({
    prisma,
    importRunId: run.id,
    importSourceId: source.id,
    records: [{ sale }],
  });
  const record = await prisma.canonicalSalesRecord.findUniqueOrThrow({
    where: { id: result.createdIds[0] },
    include: { importRun: true, importSource: true },
  });

  assert.equal(record.importRun.id, run.id);
  assert.equal(record.importSource.id, source.id);
  assert.equal(record.approvalStatus, ImportApprovalStatus.PENDING);
  assert.equal(record.businessKey, buildSalesBusinessKey(sale));
  assert.equal(record.sourceHash, source.sourceHash);
  assert.equal(record.parserVersion, source.parserVersion);
  assert.equal(record.importedBy, run.importedBy);
  assert.equal(record.importedAt.toISOString(), run.importedAt.toISOString());
  assert.equal(record.productName, sale.productName);
  assert.equal(JSON.parse(record.validationJson).ok, true);
});

test("is idempotent by ImportSourceID + BusinessKey + SourceHash", async () => {
  const { run, source } = await createTraceability();
  const first = await persistSalesImportLedger({
    prisma,
    importRunId: run.id,
    importSourceId: source.id,
    records: [{ sale }],
  });
  const second = await persistSalesImportLedger({
    prisma,
    importRunId: run.id,
    importSourceId: source.id,
    records: [{ sale }],
  });

  assert.equal(first.createdIds.length, 1);
  assert.deepEqual(second.createdIds, []);
  assert.deepEqual(second.existingIds, first.createdIds);
  assert.equal(await prisma.canonicalSalesRecord.count(), 1);
});

test("fails closed when the legacy direct approval transition is called", async () => {
  const { run, source } = await createTraceability();
  const persisted = await persistSalesImportLedger({
    prisma,
    importRunId: run.id,
    importSourceId: source.id,
    records: [{ sale }],
  });
  const recordId = persisted.createdIds[0];

  assert.deepEqual(await getApprovedSalesImportRecords({ prisma }), []);
  await assert.rejects(
    transitionSalesImportApproval({
      prisma,
      recordId,
      to: ImportApprovalStatus.APPROVED,
      reviewedBy: "CEO",
    }),
    /Direct Sales Import approval transition is disabled/,
  );
  const unchanged = await prisma.canonicalSalesRecord.findUniqueOrThrow({
    where: { id: recordId },
  });
  assert.equal(unchanged.approvalStatus, ImportApprovalStatus.PENDING);
  assert.equal(unchanged.reviewedBy, null);
  assert.deepEqual(await getApprovedSalesImportRecords({ prisma }), []);
});

test("routes invalid records to review and prevents their approval", async () => {
  const { run, source } = await createTraceability();
  const invalidSale = { ...sale, currency: "yen" };
  const result = await persistSalesImportLedger({
    prisma,
    importRunId: run.id,
    importSourceId: source.id,
    records: [{ sale: invalidSale }],
  });
  const record = await prisma.canonicalSalesRecord.findUniqueOrThrow({
    where: { id: result.createdIds[0] },
  });

  assert.equal(record.approvalStatus, ImportApprovalStatus.REVIEW_REQUIRED);
  assert.equal(
    (await getApprovedSalesImportRecords({ prisma })).length,
    0,
  );
});

test("rolls back partial writes when a record bypasses the approval flow", async () => {
  const { run, source } = await createTraceability();

  await assert.rejects(
    persistSalesImportLedger({
      prisma,
      importRunId: run.id,
      importSourceId: source.id,
      records: [
        { sale },
        { sale: { ...sale, productName: "別商品" }, approvalStatus: ImportApprovalStatus.APPROVED },
      ],
    }),
    /must start in a reviewable state/,
  );
  assert.equal(await prisma.canonicalSalesRecord.count(), 0);
});

test("rejects an ImportRun and ImportSource traceability mismatch", async () => {
  const first = await createTraceability();
  const otherRun = await prisma.importRun.create({
    data: {
      status: "review_required",
      importedAt: new Date(),
      importedBy: "test-runner",
      pipelineVersion: "sales-import-v1",
    },
  });

  await assert.rejects(
    persistSalesImportLedger({
      prisma,
      importRunId: otherRun.id,
      importSourceId: first.source.id,
      records: [{ sale }],
    }),
    /traceability mismatch/,
  );
});
