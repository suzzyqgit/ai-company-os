import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  buildProductMasterManifestFromRecords,
  initializeProductMasterFoundation,
} from "../features/product-master/foundation.ts";

const execFileAsync = promisify(execFile);

async function createPrismaClient() {
  const directory = await mkdtemp(join(process.env.TMPDIR ?? "/tmp", "product-master-"));
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

async function createImportLedger(prisma: PrismaClient) {
  const importRun = await prisma.importRun.create({
    data: {
      status: "completed",
      importedAt: new Date("2026-07-23T00:00:00.000Z"),
      importedBy: "test-runner",
      pipelineVersion: "sales-import-v1",
      importMode: "COMMIT",
    },
  });
  const importSource = await prisma.importSource.create({
    data: {
      importRunId: importRun.id,
      sourceType: "note_sales_csv",
      sourceFile: "source.csv",
      sourceHash: "b".repeat(64),
      parserVersion: "note-sales-csv-v1",
      metadataJson: "{}",
    },
  });

  return { importRun, importSource };
}

async function createCanonicalRecord({
  prisma,
  importRunId,
  importSourceId,
  id,
  productName,
  grossAmount,
}: {
  prisma: PrismaClient;
  importRunId: string;
  importSourceId: string;
  id: string;
  productName: string;
  grossAmount: number;
}) {
  return prisma.canonicalSalesRecord.create({
    data: {
      id,
      importRunId,
      importSourceId,
      businessKey: `business-${id}`,
      sourceHash: `${id}${"c".repeat(64)}`.slice(0, 64),
      schemaVersion: "canonical-sales-record-v1",
      parserVersion: "note-sales-csv-v1",
      saleDate: new Date("2026-07-23T00:00:00.000Z"),
      productName,
      originalProductName: productName,
      normalizedProductName: productName.toLowerCase(),
      quantity: 1,
      grossAmount,
      netAmount: Math.floor(grossAmount / 1.1),
      currency: "JPY",
      platform: "note",
      source: "note-sales-csv",
      confidence: 1,
      validationJson: "{}",
      importedAt: new Date("2026-07-23T00:00:00.000Z"),
      importedBy: "test-runner",
    },
  });
}

test("builds a deterministic Product Master manifest from canonical sales records", () => {
  const manifest = buildProductMasterManifestFromRecords([
    {
      id: "record-b",
      productName: "Product A",
      originalProductName: "Product A",
      normalizedProductName: "product-a",
      quantity: 1,
      grossAmount: 1500,
      netAmount: 1363,
    },
    {
      id: "record-a",
      productName: "Product A",
      originalProductName: "Product A",
      normalizedProductName: "product-a",
      quantity: 1,
      grossAmount: 1000,
      netAmount: 909,
    },
    {
      id: "record-c",
      productName: "Product B",
      originalProductName: "Product B",
      normalizedProductName: "product-b",
      quantity: 1,
      grossAmount: 980,
      netAmount: 890,
    },
  ]);

  assert.equal(manifest.productCount, 2);
  assert.equal(manifest.articleCount, 2);
  assert.equal(manifest.canonicalRecordCount, 3);
  assert.equal(manifest.grossAmount, 3480);
  assert.deepEqual(
    manifest.items.map((item) => item.normalizedProductName),
    ["product-a", "product-b"],
  );
  assert.deepEqual(manifest.items[0].canonicalRecordIds, ["record-a", "record-b"]);
  assert.equal(manifest.items[0].observedUnitPrices.length, 2);
  assert.match(manifest.manifestFingerprint, /^[a-f0-9]{64}$/);
});

test("initializes Product and Article records idempotently without promoting sales", async () => {
  const { prisma, cleanup } = await createPrismaClient();
  try {
    const { importRun, importSource } = await createImportLedger(prisma);
    await createCanonicalRecord({
      prisma,
      importRunId: importRun.id,
      importSourceId: importSource.id,
      id: "record-a",
      productName: "Product A",
      grossAmount: 1000,
    });
    await createCanonicalRecord({
      prisma,
      importRunId: importRun.id,
      importSourceId: importSource.id,
      id: "record-b",
      productName: "Product B",
      grossAmount: 980,
    });

    const first = await initializeProductMasterFoundation({ prisma });
    const second = await initializeProductMasterFoundation({ prisma });

    assert.equal(first.createdProducts, 2);
    assert.equal(first.createdArticles, 2);
    assert.equal(first.updatedCanonicalRecords, 2);
    assert.equal(second.createdProducts, 0);
    assert.equal(second.updatedProducts, 2);
    assert.equal(second.createdArticles, 0);
    assert.equal(second.updatedArticles, 2);
    assert.equal(second.updatedCanonicalRecords, 2);

    assert.equal(await prisma.product.count(), 2);
    assert.equal(await prisma.article.count(), 2);
    assert.equal(
      await prisma.canonicalSalesRecord.count({
        where: {
          candidateProductId: {
            not: null,
          },
          candidateArticleId: {
            not: null,
          },
          matchConfidence: 1,
        },
      }),
      2,
    );
    assert.equal(await prisma.sale.count(), 0);
    assert.equal(await prisma.saleItem.count(), 0);
    assert.equal(await prisma.promotionRun.count(), 0);
  } finally {
    await prisma.$disconnect();
    await cleanup();
  }
});
