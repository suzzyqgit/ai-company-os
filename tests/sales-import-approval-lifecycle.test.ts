import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { ImportApprovalStatus, PrismaClient } from "@prisma/client";
import {
  buildSalesImportApprovalFingerprint,
  createSalesImportApprovalLifecycle,
  salesImportApprovalCanonicalizationVersion,
  salesImportApprovalFingerprintAlgorithm,
  salesImportApprovalFingerprintContractVersion,
  unavailableRuntimeCeoAuthorityVerifier,
  type SalesImportApprovalAuthorityVerifier,
  type SalesImportApprovalTarget,
  type SalesImportAuthorityVerificationRequest,
} from "../features/imports/import-pipeline/index.ts";

let prisma: PrismaClient;
let cleanupDatabase: () => Promise<void>;

const reviewedAt = new Date("2026-09-02T00:00:00.000Z");

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function createPrismaClient() {
  const directory = await mkdtemp(
    join(process.env.TMPDIR ?? "/tmp", "sales-approval-lifecycle-"),
  );
  const databasePath = join(directory, "test.db");
  const database = new DatabaseSync(databasePath);
  const migrationsRoot = join(process.cwd(), "prisma", "migrations");
  const migrationDirectories = (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationDirectory of migrationDirectories) {
    const sql = await readFile(
      join(migrationsRoot, migrationDirectory, "migration.sql"),
      "utf8",
    );
    database.exec(sql);
  }
  database.close();

  return {
    prisma: new PrismaClient({
      datasources: { db: { url: `file:${databasePath}` } },
    }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

type FixtureBinding = {
  target: SalesImportApprovalTarget;
  targetId: string;
  importRunId: string;
  fingerprint: string;
  decisionRef: string;
  authorityEvidence: string;
};

class FixtureAuthorityVerifier implements SalesImportApprovalAuthorityVerifier {
  #bindings = new Map<string, FixtureBinding>();

  allow(binding: FixtureBinding) {
    this.#bindings.set(binding.decisionRef, binding);
  }

  async verify(request: SalesImportAuthorityVerificationRequest) {
    const binding = this.#bindings.get(request.decisionRef);
    if (!binding) throw new Error("Fixture authority decision is not bound");
    assert.equal(request.purpose, "SALES_IMPORT_APPROVAL");
    assert.equal(request.target, binding.target);
    assert.equal(request.targetId, binding.targetId);
    assert.equal(request.importRunId, binding.importRunId);
    assert.equal(request.approvalFingerprint, binding.fingerprint);
    assert.equal(
      request.fingerprintVersion,
      salesImportApprovalFingerprintContractVersion,
    );
    assert.equal(request.authorityEvidence, binding.authorityEvidence);
    return {
      subjectId: "fixture-ceo-subject",
      authorityRole: "CEO" as const,
      decisionRef: binding.decisionRef,
      authorityEvidenceDigest: digest(
        JSON.stringify({
          verifier: "isolated-fixture-verifier-v1",
          ...binding,
        }),
      ),
      verifierId: "isolated-fixture-verifier-v1",
    };
  }
}

async function createFixture({ invalidRecord = false } = {}) {
  const run = await prisma.importRun.create({
    data: {
      id: "run-approval-fixture",
      status: "COMPLETED",
      completedAt: new Date("2026-09-01T23:59:00.000Z"),
      importedAt: new Date("2026-09-01T23:58:00.000Z"),
      importedBy: "isolated-test-importer",
      pipelineVersion: "production-initial-sales-import-v1",
      summaryJson: '{"records":4,"sources":2}',
      importMode: "COMMIT",
    },
  });

  const sources = [];
  for (const index of [2, 1]) {
    sources.push(
      await prisma.importSource.create({
        data: {
          id: `source-${index}`,
          importRunId: run.id,
          sourceType: "note_sales_csv",
          sourceFile: `anonymous-${index}.csv`,
          sourceHash: digest(`source-${index}`),
          parserVersion: "note-sales-csv-v1",
          confidence: 0.99,
          metadataJson: JSON.stringify({ importIndex: index }),
        },
      }),
    );
  }

  const records = [];
  for (const source of sources) {
    for (const index of [2, 1]) {
      const recordIndex = Number(source.id.at(-1)) * 10 + index;
      records.push(
        await prisma.canonicalSalesRecord.create({
          data: {
            id: `record-${recordIndex}`,
            importRunId: run.id,
            importSourceId: source.id,
            businessKey: digest(`business-${recordIndex}`),
            sourceHash: source.sourceHash,
            schemaVersion: "canonical-sales-v1",
            parserVersion: source.parserVersion,
            saleDate: new Date(`2026-08-${recordIndex}T00:00:00.000Z`),
            productName: `Anonymous Product ${recordIndex}`,
            originalProductName: `Anonymous Product ${recordIndex}`,
            normalizedProductName: `Anonymous Product ${recordIndex}`,
            quantity: 1,
            grossAmount: 1000 + recordIndex,
            netAmount: 900 + recordIndex,
            currency: "JPY",
            platform: "note",
            source: "note-sales-csv:v1",
            confidence: 0.99,
            validationJson: JSON.stringify({
              ok: !(invalidRecord && recordIndex === 11),
              issues: invalidRecord && recordIndex === 11 ? ["invalid"] : [],
            }),
            importedAt: run.importedAt,
            importedBy: run.importedBy,
          },
        }),
      );
    }
  }
  return { run, sources, records };
}

async function currentFingerprint(importRunId: string) {
  return (
    await buildSalesImportApprovalFingerprint({ prisma, importRunId })
  ).fingerprint;
}

async function authorizeAndApprove({
  verifier,
  target,
  targetId,
  importRunId,
  decisionRef,
}: {
  verifier: FixtureAuthorityVerifier;
  target: SalesImportApprovalTarget;
  targetId: string;
  importRunId: string;
  decisionRef: string;
}) {
  const fingerprint = await currentFingerprint(importRunId);
  const authorityEvidence = `fixture-evidence:${decisionRef}`;
  verifier.allow({
    target,
    targetId,
    importRunId,
    fingerprint,
    decisionRef,
    authorityEvidence,
  });
  const lifecycle = createSalesImportApprovalLifecycle({
    prisma,
    authorityVerifier: verifier,
  });
  const request = {
    expectedFingerprint: fingerprint,
    authorization: { decisionRef, authorityEvidence },
    reason: "isolated fixture approval",
    reviewedAt,
  };
  if (target === "RECORD") {
    return lifecycle.approveRecord({ ...request, recordId: targetId });
  }
  if (target === "SOURCE") {
    return lifecycle.approveSource({ ...request, importSourceId: targetId });
  }
  return lifecycle.approveRun({ ...request, importRunId: targetId });
}

async function approveAllRecords(
  verifier: FixtureAuthorityVerifier,
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  for (const [index, record] of fixture.records.entries()) {
    await authorizeAndApprove({
      verifier,
      target: "RECORD",
      targetId: record.id,
      importRunId: fixture.run.id,
      decisionRef: `DEC-RECORD-${index}`,
    });
  }
}

async function approvalSnapshot() {
  return {
    runs: await prisma.importRun.findMany({ orderBy: { id: "asc" } }),
    sources: await prisma.importSource.findMany({ orderBy: { id: "asc" } }),
    records: await prisma.canonicalSalesRecord.findMany({ orderBy: { id: "asc" } }),
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

test("builds an equal deterministic fingerprint with explicitly ordered collections", async () => {
  const fixture = await createFixture();
  const first = await buildSalesImportApprovalFingerprint({
    prisma,
    importRunId: fixture.run.id,
  });
  const second = await buildSalesImportApprovalFingerprint({
    prisma,
    importRunId: fixture.run.id,
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(
    first.canonicalInput.fingerprintContractVersion,
    salesImportApprovalFingerprintContractVersion,
  );
  assert.equal(
    first.canonicalInput.fingerprintAlgorithm,
    salesImportApprovalFingerprintAlgorithm,
  );
  assert.equal(
    first.canonicalInput.canonicalizationVersion,
    salesImportApprovalCanonicalizationVersion,
  );
  const sources = first.canonicalInput.orderedSources as Array<{ id: string }>;
  const records = first.canonicalInput.orderedCanonicalSalesRecords as Array<{
    businessKey: string;
  }>;
  assert.deepEqual(sources.map(({ id }) => id), ["source-1", "source-2"]);
  assert.deepEqual(
    records.map(({ businessKey }) => businessKey),
    [...records.map(({ businessKey }) => businessKey)].sort(),
  );
});

test("changes the fingerprint when canonical Record content changes", async () => {
  const fixture = await createFixture();
  const before = await currentFingerprint(fixture.run.id);
  await prisma.canonicalSalesRecord.update({
    where: { id: fixture.records[0].id },
    data: { grossAmount: { increment: 1 } },
  });
  assert.notEqual(await currentFingerprint(fixture.run.id), before);
});

test("changes the fingerprint when Source hash provenance changes", async () => {
  const fixture = await createFixture();
  const before = await currentFingerprint(fixture.run.id);
  await prisma.importSource.update({
    where: { id: fixture.sources[0].id },
    data: { sourceHash: digest("mutated-source") },
  });
  assert.notEqual(await currentFingerprint(fixture.run.id), before);
});

test("fingerprint mismatch performs zero approval writes", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  const before = await approvalSnapshot();
  const lifecycle = createSalesImportApprovalLifecycle({
    prisma,
    authorityVerifier: verifier,
  });
  await assert.rejects(
    lifecycle.approveRecord({
      recordId: fixture.records[0].id,
      expectedFingerprint: "f".repeat(64),
      authorization: {
        decisionRef: "FORGED",
        authorityEvidence: "forged",
        claimedAuthorityRole: "CEO",
      },
      reason: "must not write",
    }),
    /fingerprint mismatch/,
  );
  assert.deepEqual(await approvalSnapshot(), before);
});

test("caller-forged CEO role is rejected when runtime binding is unavailable", async () => {
  const fixture = await createFixture();
  const before = await approvalSnapshot();
  const lifecycle = createSalesImportApprovalLifecycle({
    prisma,
    authorityVerifier: unavailableRuntimeCeoAuthorityVerifier,
  });
  await assert.rejects(
    lifecycle.approveRecord({
      recordId: fixture.records[0].id,
      expectedFingerprint: await currentFingerprint(fixture.run.id),
      authorization: {
        decisionRef: "caller-selected-decision",
        authorityEvidence: "caller-selected-evidence",
        claimedAuthorityRole: "CEO",
      },
      reason: "caller claim is not authorization",
    }),
    /RUNTIME CEO AUTHORITY BINDING: UNRESOLVED/,
  );
  assert.deepEqual(await approvalSnapshot(), before);
});

test("caller-forged decision reference is rejected by the verifier", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  const fingerprint = await currentFingerprint(fixture.run.id);
  verifier.allow({
    target: "RECORD",
    targetId: fixture.records[0].id,
    importRunId: fixture.run.id,
    fingerprint,
    decisionRef: "BOUND-DECISION",
    authorityEvidence: "bound-evidence",
  });
  const lifecycle = createSalesImportApprovalLifecycle({
    prisma,
    authorityVerifier: verifier,
  });
  await assert.rejects(
    lifecycle.approveRecord({
      recordId: fixture.records[0].id,
      expectedFingerprint: fingerprint,
      authorization: {
        decisionRef: "FORGED-DECISION",
        authorityEvidence: "bound-evidence",
      },
      reason: "must be verified",
    }),
    /decision is not bound/,
  );
  assert.equal(
    (await prisma.canonicalSalesRecord.findUniqueOrThrow({
      where: { id: fixture.records[0].id },
    })).approvalStatus,
    ImportApprovalStatus.PENDING,
  );
});

test("rejects an unversioned verifier identifier with zero approval writes", async () => {
  const fixture = await createFixture();
  const fingerprint = await currentFingerprint(fixture.run.id);
  const before = await approvalSnapshot();
  const unversionedVerifier: SalesImportApprovalAuthorityVerifier = {
    async verify(request) {
      return {
        subjectId: "fixture-ceo-subject",
        authorityRole: "CEO",
        decisionRef: request.decisionRef,
        authorityEvidenceDigest: digest("unversioned-verifier-evidence"),
        verifierId: "isolated-fixture-verifier",
      };
    },
  };
  const lifecycle = createSalesImportApprovalLifecycle({
    prisma,
    authorityVerifier: unversionedVerifier,
  });
  await assert.rejects(
    lifecycle.approveRecord({
      recordId: fixture.records[0].id,
      expectedFingerprint: fingerprint,
      authorization: {
        decisionRef: "DEC-UNVERSIONED-VERIFIER",
        authorityEvidence: "fixture-evidence",
      },
      reason: "must reject unversioned verifier identity",
    }),
    /versioned immutable identifier/,
  );
  assert.deepEqual(await approvalSnapshot(), before);
});

test("Record approval rejects failed canonical validation", async () => {
  const fixture = await createFixture({ invalidRecord: true });
  const verifier = new FixtureAuthorityVerifier();
  const invalid = fixture.records.find(({ id }) => id === "record-11")!;
  const fingerprint = await currentFingerprint(fixture.run.id);
  verifier.allow({
    target: "RECORD",
    targetId: invalid.id,
    importRunId: fixture.run.id,
    fingerprint,
    decisionRef: "DEC-INVALID",
    authorityEvidence: "fixture-evidence:DEC-INVALID",
  });
  const lifecycle = createSalesImportApprovalLifecycle({ prisma, authorityVerifier: verifier });
  await assert.rejects(
    lifecycle.approveRecord({
      recordId: invalid.id,
      expectedFingerprint: fingerprint,
      authorization: {
        decisionRef: "DEC-INVALID",
        authorityEvidence: "fixture-evidence:DEC-INVALID",
      },
      reason: "must fail validation",
    }),
    /cannot be APPROVED/,
  );
  assert.equal(
    (await prisma.canonicalSalesRecord.findUniqueOrThrow({ where: { id: invalid.id } }))
      .approvalStatus,
    ImportApprovalStatus.PENDING,
  );
});

test("allows partial Record approval while Source and Run remain PENDING", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  await authorizeAndApprove({
    verifier,
    target: "RECORD",
    targetId: fixture.records[0].id,
    importRunId: fixture.run.id,
    decisionRef: "DEC-PARTIAL",
  });
  assert.equal(
    await prisma.canonicalSalesRecord.count({
      where: { approvalStatus: ImportApprovalStatus.APPROVED },
    }),
    1,
  );
  assert.equal(
    await prisma.importSource.count({
      where: { approvalStatus: ImportApprovalStatus.APPROVED },
    }),
    0,
  );
  assert.equal(
    (await prisma.importRun.findUniqueOrThrow({ where: { id: fixture.run.id } }))
      .approvalStatus,
    ImportApprovalStatus.PENDING,
  );
});

test("blocks Source approval until all required child Records are APPROVED", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  const source = fixture.sources[0];
  const fingerprint = await currentFingerprint(fixture.run.id);
  const lifecycle = createSalesImportApprovalLifecycle({ prisma, authorityVerifier: verifier });
  await assert.rejects(
    lifecycle.approveSource({
      importSourceId: source.id,
      expectedFingerprint: fingerprint,
      authorization: { decisionRef: "DEC-SOURCE-EARLY", authorityEvidence: "evidence" },
      reason: "too early",
    }),
    /every child Canonical Sales Record/,
  );
  const unchanged = await prisma.importSource.findUniqueOrThrow({ where: { id: source.id } });
  assert.equal(unchanged.approvalStatus, ImportApprovalStatus.PENDING);
  assert.equal(unchanged.reviewedAt, null);
});

test("blocks Run approval until every required Source is APPROVED", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  await approveAllRecords(verifier, fixture);
  await authorizeAndApprove({
    verifier,
    target: "SOURCE",
    targetId: fixture.sources[0].id,
    importRunId: fixture.run.id,
    decisionRef: "DEC-ONE-SOURCE",
  });
  const lifecycle = createSalesImportApprovalLifecycle({ prisma, authorityVerifier: verifier });
  await assert.rejects(
    lifecycle.approveRun({
      importRunId: fixture.run.id,
      expectedFingerprint: await currentFingerprint(fixture.run.id),
      authorization: { decisionRef: "DEC-RUN-EARLY", authorityEvidence: "evidence" },
      reason: "too early",
    }),
    /every ImportSource/,
  );
  assert.equal(
    (await prisma.importRun.findUniqueOrThrow({ where: { id: fixture.run.id } }))
      .approvalStatus,
    ImportApprovalStatus.PENDING,
  );
});

test("Source transition is atomic when a child gate fails", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  await approveAllRecords(verifier, fixture);
  const source = fixture.sources[0];
  const child = await prisma.canonicalSalesRecord.findFirstOrThrow({
    where: { importSourceId: source.id },
  });
  await prisma.canonicalSalesRecord.update({
    where: { id: child.id },
    data: { approvalStatus: ImportApprovalStatus.REVIEW_REQUIRED },
  });
  const before = await approvalSnapshot();
  const lifecycle = createSalesImportApprovalLifecycle({ prisma, authorityVerifier: verifier });
  await assert.rejects(
    lifecycle.approveSource({
      importSourceId: source.id,
      expectedFingerprint: await currentFingerprint(fixture.run.id),
      authorization: { decisionRef: "DEC-SOURCE-ATOMIC", authorityEvidence: "evidence" },
      reason: "must roll back",
    }),
    /every child Canonical Sales Record/,
  );
  assert.deepEqual(await approvalSnapshot(), before);
});

test("Run transition is atomic when a Source gate fails", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  await approveAllRecords(verifier, fixture);
  for (const [index, source] of fixture.sources.entries()) {
    await authorizeAndApprove({
      verifier,
      target: "SOURCE",
      targetId: source.id,
      importRunId: fixture.run.id,
      decisionRef: `DEC-SOURCE-${index}`,
    });
  }
  await prisma.importSource.update({
    where: { id: fixture.sources[0].id },
    data: { approvalStatus: ImportApprovalStatus.REVIEW_REQUIRED },
  });
  const before = await approvalSnapshot();
  const lifecycle = createSalesImportApprovalLifecycle({ prisma, authorityVerifier: verifier });
  await assert.rejects(
    lifecycle.approveRun({
      importRunId: fixture.run.id,
      expectedFingerprint: await currentFingerprint(fixture.run.id),
      authorization: { decisionRef: "DEC-RUN-ATOMIC", authorityEvidence: "evidence" },
      reason: "must roll back",
    }),
    /every ImportSource/,
  );
  assert.deepEqual(await approvalSnapshot(), before);
});

test("repeated invocation is idempotent and does not overwrite audit evidence", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  const record = await authorizeAndApprove({
    verifier,
    target: "RECORD",
    targetId: fixture.records[0].id,
    importRunId: fixture.run.id,
    decisionRef: "DEC-IDEMPOTENT",
  });
  const current = await currentFingerprint(fixture.run.id);
  verifier.allow({
    target: "RECORD",
    targetId: record.id,
    importRunId: fixture.run.id,
    fingerprint: current,
    decisionRef: "DEC-IDEMPOTENT-RETRY",
    authorityEvidence: "fixture-evidence:DEC-IDEMPOTENT-RETRY",
  });
  const lifecycle = createSalesImportApprovalLifecycle({ prisma, authorityVerifier: verifier });
  const repeated = await lifecycle.approveRecord({
    recordId: record.id,
    expectedFingerprint: current,
    authorization: {
      decisionRef: "DEC-IDEMPOTENT-RETRY",
      authorityEvidence: "fixture-evidence:DEC-IDEMPOTENT-RETRY",
    },
    reason: "retry",
    reviewedAt: new Date("2026-09-02T01:00:00.000Z"),
  });
  assert.equal(repeated.approvalDecisionRef, "DEC-IDEMPOTENT");
  assert.equal(repeated.approvalVerifierId, "isolated-fixture-verifier-v1");
  assert.equal(
    repeated.approvalFingerprintVersion,
    salesImportApprovalFingerprintContractVersion,
  );
  assert.equal(repeated.reviewedAt?.toISOString(), reviewedAt.toISOString());
});

test("persists complete bounded audit evidence for Record, Source, and Run", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  await approveAllRecords(verifier, fixture);
  for (const [index, source] of fixture.sources.entries()) {
    await authorizeAndApprove({
      verifier,
      target: "SOURCE",
      targetId: source.id,
      importRunId: fixture.run.id,
      decisionRef: `DEC-AUDIT-SOURCE-${index}`,
    });
  }
  await authorizeAndApprove({
    verifier,
    target: "RUN",
    targetId: fixture.run.id,
    importRunId: fixture.run.id,
    decisionRef: "DEC-AUDIT-RUN",
  });

  const values = [
    ...(await prisma.canonicalSalesRecord.findMany()),
    ...(await prisma.importSource.findMany()),
    ...(await prisma.importRun.findMany()),
  ];
  assert.equal(values.length, 7);
  for (const value of values) {
    assert.equal(value.approvalStatus, ImportApprovalStatus.APPROVED);
    assert.equal(value.reviewedBy, "fixture-ceo-subject");
    assert.equal(value.reviewedAt?.toISOString(), reviewedAt.toISOString());
    assert.equal(value.reviewReason, "isolated fixture approval");
    assert.match(value.approvalFingerprint ?? "", /^[a-f0-9]{64}$/);
    assert.equal(
      value.approvalFingerprintVersion,
      salesImportApprovalFingerprintContractVersion,
    );
    assert.match(value.approvalDecisionRef ?? "", /^DEC-/);
    assert.equal(value.approvalAuthorityRole, "CEO");
    assert.match(value.approvalAuthorityEvidenceDigest ?? "", /^[a-f0-9]{64}$/);
    assert.equal(value.approvalVerifierId, "isolated-fixture-verifier-v1");
  }
});

test("approval lifecycle does not mutate Sale, SaleItem, PromotionRun, or unrelated ODL", async () => {
  const fixture = await createFixture();
  const verifier = new FixtureAuthorityVerifier();
  const article = await prisma.article.create({
    data: { title: "Unrelated", price: 100, pv: 1, purchases: 0 },
  });
  const product = await prisma.product.create({ data: { name: "Unrelated" } });
  const unrelatedBefore = {
    article: await prisma.article.findUniqueOrThrow({ where: { id: article.id } }),
    product: await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
    saleCount: await prisma.sale.count(),
    saleItemCount: await prisma.saleItem.count(),
    promotionRunCount: await prisma.promotionRun.count(),
  };
  await approveAllRecords(verifier, fixture);
  for (const [index, source] of fixture.sources.entries()) {
    await authorizeAndApprove({
      verifier,
      target: "SOURCE",
      targetId: source.id,
      importRunId: fixture.run.id,
      decisionRef: `DEC-NO-MUTATION-SOURCE-${index}`,
    });
  }
  await authorizeAndApprove({
    verifier,
    target: "RUN",
    targetId: fixture.run.id,
    importRunId: fixture.run.id,
    decisionRef: "DEC-NO-MUTATION-RUN",
  });
  assert.deepEqual(
    {
      article: await prisma.article.findUniqueOrThrow({ where: { id: article.id } }),
      product: await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
      saleCount: await prisma.sale.count(),
      saleItemCount: await prisma.saleItem.count(),
      promotionRunCount: await prisma.promotionRun.count(),
    },
    unrelatedBefore,
  );
});
