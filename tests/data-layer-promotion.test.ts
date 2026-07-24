import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  ImportApprovalStatus,
  PrismaClient,
  PromotionRunStatus,
} from "@prisma/client";
import {
  buildDataLayerPromotionPlan,
  executeDataLayerPromotion,
} from "../features/imports/import-pipeline/index.ts";

let prisma: PrismaClient;
let cleanupDatabase: () => Promise<void>;

async function createPrismaClient() {
  const directory = await mkdtemp(join(process.cwd(), ".tmp-promotion-"));
  const databasePath = join(directory, "test.db");
  const databaseUrl = `file:${databasePath}`;
  const database = new DatabaseSync(databasePath);
  const migrationsRoot = join(process.cwd(), "prisma", "migrations");
  const migrationDirectories = (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const migrationDirectory of migrationDirectories) {
    const migrationPath = join(migrationsRoot, migrationDirectory, "migration.sql");
    const sql = await readFile(migrationPath, "utf8");
    database.exec(sql);
  }
  database.close();
  return {
    prisma: new PrismaClient({ datasources: { db: { url: databaseUrl } } }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

async function createApprovedFixture(recordCount = 2) {
  const product = await prisma.product.create({ data: { name: "Owner確定商品" } });
  const run = await prisma.importRun.create({
    data: {
      status: "COMPLETED",
      importedAt: new Date("2026-07-24T00:00:00.000Z"),
      importedBy: "test",
      pipelineVersion: "v1",
      approvalStatus: ImportApprovalStatus.APPROVED,
    },
  });
  const source = await prisma.importSource.create({
    data: {
      importRunId: run.id,
      sourceType: "note_sales_csv",
      sourceFile: "anonymous.csv",
      sourceHash: "a".repeat(64),
      parserVersion: "v1",
      metadataJson: "{}",
      approvalStatus: ImportApprovalStatus.APPROVED,
    },
  });
  const records = await Promise.all(
    Array.from({ length: recordCount }, (_, index) =>
      prisma.canonicalSalesRecord.create({
        data: {
          importRunId: run.id,
          importSourceId: source.id,
          businessKey: `${index}`.repeat(64),
          sourceHash: source.sourceHash,
          schemaVersion: "1.0",
          parserVersion: "v1",
          saleDate: new Date(`2026-07-${15 + index}T00:00:00.000Z`),
          productName: "商品",
          originalProductName: "商品",
          normalizedProductName: "商品",
          quantity: 1,
          grossAmount: 1000 + index,
          netAmount: 900 + index,
          currency: "JPY",
          platform: "note",
          source: "note-sales-csv:v1",
          confidence: 1,
          approvalStatus: ImportApprovalStatus.APPROVED,
          validationJson: '{"ok":true}',
          importedAt: run.importedAt,
          importedBy: "test",
        },
      }),
    ),
  );
  const resolutions = records.map((record) => ({
    canonicalSalesRecordId: record.id,
    productId: product.id,
    confirmedByOwner: true as const,
  }));
  return { run, source, product, records, resolutions };
}

async function authorizeFixture(fixture: Awaited<ReturnType<typeof createApprovedFixture>>) {
  const plan = await buildDataLayerPromotionPlan({
    prisma,
    importRunId: fixture.run.id,
    resolutions: fixture.resolutions,
  });
  return {
    plan,
    authorization: {
      ownerApprovedBy: "owner",
      ownerApprovedAt: new Date("2026-07-24T01:00:00.000Z"),
      approvedFingerprint: plan.inputFingerprint,
    },
  };
}

test.before(async () => {
  const client = await createPrismaClient();
  prisma = client.prisma;
  cleanupDatabase = client.cleanup;
});

test.after(async () => {
  await prisma?.$disconnect();
  await cleanupDatabase?.();
});

test.beforeEach(async () => {
  await prisma.promotionRun.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.canonicalSalesRecord.deleteMany();
  await prisma.importSource.deleteMany();
  await prisma.importRun.deleteMany();
  await prisma.article.deleteMany();
  await prisma.product.deleteMany();
});

test("promotes approved records atomically with matching counts and amounts", async () => {
  const fixture = await createApprovedFixture();
  const { plan, authorization } = await authorizeFixture(fixture);
  const result = await executeDataLayerPromotion({
    prisma,
    plan,
    authorization,
    executedBy: "chief-software-engineer",
    now: new Date("2026-07-24T02:00:00.000Z"),
  });

  assert.equal(result.status, PromotionRunStatus.COMPLETED);
  assert.equal(result.promotedCount, 2);
  assert.equal(await prisma.sale.count(), plan.recordCount);
  assert.equal(await prisma.saleItem.count(), plan.recordCount);
  const totals = await prisma.sale.aggregate({
    _sum: { grossAmount: true, netAmount: true },
  });
  assert.equal(totals._sum.grossAmount, plan.grossAmount);
  assert.equal(totals._sum.netAmount, plan.netAmount);
});

test("is idempotent on re-execution and records skipped rows", async () => {
  const fixture = await createApprovedFixture();
  const { plan, authorization } = await authorizeFixture(fixture);
  await executeDataLayerPromotion({
    prisma, plan, authorization, executedBy: "test", now: new Date("2026-07-24T02:00:00Z"),
  });
  const rerun = await executeDataLayerPromotion({
    prisma, plan, authorization, executedBy: "test", now: new Date("2026-07-24T03:00:00Z"),
  });

  assert.equal(await prisma.sale.count(), 2);
  assert.equal(rerun.promotedCount, 0);
  assert.equal(rerun.skippedCount, 2);
});

test("rolls back every Sale and SaleItem on a partial failure", async () => {
  const fixture = await createApprovedFixture();
  const { plan, authorization } = await authorizeFixture(fixture);
  await assert.rejects(
    executeDataLayerPromotion({
      prisma,
      plan,
      authorization,
      executedBy: "test",
      now: new Date("2026-07-24T02:00:00Z"),
      failAfterPromotions: 1,
    }),
    /Injected promotion failure/,
  );

  assert.equal(await prisma.sale.count(), 0);
  assert.equal(await prisma.saleItem.count(), 0);
  const audit = await prisma.promotionRun.findFirstOrThrow();
  assert.equal(audit.status, PromotionRunStatus.FAILED);
  assert.equal(audit.rollbackExecuted, true);
});

test("requires explicit Owner resolution and matching COMMIT approval", async () => {
  const fixture = await createApprovedFixture(1);
  await assert.rejects(
    buildDataLayerPromotionPlan({
      prisma,
      importRunId: fixture.run.id,
      resolutions: [],
    }),
    /Owner-confirmed Product resolution/,
  );
  const { plan, authorization } = await authorizeFixture(fixture);
  await assert.rejects(
    executeDataLayerPromotion({
      prisma,
      plan,
      authorization: { ...authorization, approvedFingerprint: "wrong" },
      executedBy: "test",
      now: new Date("2026-07-24T02:00:00Z"),
    }),
    /does not match/,
  );
  assert.equal(await prisma.sale.count(), 0);
});
