import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { ImportApprovalStatus, PrismaClient } from "@prisma/client";
import {
  buildSalesImportApprovalManifest,
  buildSalesImportApprovalTransitionState,
  createSalesImportApprovalLifecycle,
  historicalSalesImportApprovalFingerprintContractVersionV2,
  salesImportApprovalManifestCanonicalizationVersion,
  salesImportApprovalManifestContractVersion,
  salesImportApprovalTransitionStateCanonicalizationVersion,
  salesImportApprovalTransitionStateContractVersion,
  unavailableRuntimeCeoAuthorityVerifier,
  type SalesImportApprovalAuthorityVerifier,
  type SalesImportApprovalManifest,
  type SalesImportApprovalRequest,
  type SalesImportApprovalTransitionPlanEntry,
  type SalesImportAuthorityVerificationRequest,
} from "../features/imports/import-pipeline/index.ts";

let prisma: PrismaClient;
let cleanupDatabase: () => Promise<void>;

const decisionRef = "DEC-SALES-BATCH-001";
const authorityEvidence = "fixture-evidence:DEC-SALES-BATCH-001";
const reviewedAt = new Date("2026-09-02T00:00:00.000Z");

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function createPrismaClient() {
  const directory = await mkdtemp(
    join(process.env.TMPDIR ?? "/tmp", "sales-approval-batch-v3-"),
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

type FixtureAuthorityBinding = {
  importRunId: string;
  manifestFingerprint: string;
  decisionRef: string;
  authorityEvidence: string;
};

class FixtureAuthorityVerifier implements SalesImportApprovalAuthorityVerifier {
  binding: FixtureAuthorityBinding | null = null;
  calls: SalesImportAuthorityVerificationRequest[] = [];

  allow(binding: FixtureAuthorityBinding) {
    this.binding = binding;
  }

  async verify(request: SalesImportAuthorityVerificationRequest) {
    const binding = this.binding;
    if (!binding) throw new Error("Fixture batch authority is not bound");
    this.calls.push(request);
    assert.equal(request.purpose, "SALES_IMPORT_APPROVAL");
    assert.equal(request.importRunId, binding.importRunId);
    assert.equal(request.approvalManifestFingerprint, binding.manifestFingerprint);
    assert.equal(
      request.manifestContractVersion,
      salesImportApprovalManifestContractVersion,
    );
    assert.equal(request.decisionRef, binding.decisionRef);
    assert.equal(request.authorityEvidence, binding.authorityEvidence);
    return {
      subjectId: "fixture-ceo-subject",
      authorityRole: "CEO" as const,
      decisionRef: binding.decisionRef,
      authorityEvidenceDigest: digest(
        JSON.stringify({
          verifier: "isolated-fixture-verifier-v1",
          importRunId: binding.importRunId,
          manifestFingerprint: binding.manifestFingerprint,
          decisionRef: binding.decisionRef,
          authorityEvidence: binding.authorityEvidence,
        }),
      ),
      verifierId: "isolated-fixture-verifier-v1",
    };
  }
}

async function createFixture({
  invalidRecord = false,
  runStatus = "completed",
}: { invalidRecord?: boolean; runStatus?: string } = {}) {
  const run = await prisma.importRun.create({
    data: {
      id: "run-approval-fixture",
      status: runStatus,
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

async function approvalSnapshot() {
  return {
    runs: await prisma.importRun.findMany({ orderBy: { id: "asc" } }),
    sources: await prisma.importSource.findMany({ orderBy: { id: "asc" } }),
    records: await prisma.canonicalSalesRecord.findMany({ orderBy: { id: "asc" } }),
    sales: await prisma.sale.findMany({ orderBy: { id: "asc" } }),
    saleItems: await prisma.saleItem.findMany({ orderBy: { id: "asc" } }),
    promotionRuns: await prisma.promotionRun.findMany({ orderBy: { id: "asc" } }),
  };
}

function createAuthorizedLifecycle(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  manifest: SalesImportApprovalManifest,
  verifier = new FixtureAuthorityVerifier(),
) {
  verifier.allow({
    importRunId: fixture.run.id,
    manifestFingerprint: manifest.fingerprint,
    decisionRef,
    authorityEvidence,
  });
  return {
    verifier,
    lifecycle: createSalesImportApprovalLifecycle({
      prisma,
      authorityVerifier: verifier,
    }),
  };
}

async function requestFor({
  fixture,
  manifest,
  batchDecisionRef = decisionRef,
  manifestFingerprint = manifest.fingerprint,
  manifestContractVersion = salesImportApprovalManifestContractVersion,
}: {
  fixture: Awaited<ReturnType<typeof createFixture>>;
  manifest: SalesImportApprovalManifest;
  batchDecisionRef?: string;
  manifestFingerprint?: string;
  manifestContractVersion?: string;
}): Promise<SalesImportApprovalRequest> {
  const state = await buildSalesImportApprovalTransitionState({
    prisma,
    importRunId: fixture.run.id,
    approvalManifestFingerprint: manifest.fingerprint,
    approvalDecisionRef: decisionRef,
  });
  return {
    approvalManifestFingerprint: manifestFingerprint,
    approvalManifestContractVersion: manifestContractVersion,
    expectedTransitionStateFingerprint: state.fingerprint,
    authorization: {
      decisionRef: batchDecisionRef,
      authorityEvidence,
    },
    reason: "isolated fixture batch approval",
    reviewedAt,
  };
}

async function executeEntry({
  fixture,
  manifest,
  lifecycle,
  entry,
  request,
}: {
  fixture: Awaited<ReturnType<typeof createFixture>>;
  manifest: SalesImportApprovalManifest;
  lifecycle: ReturnType<typeof createSalesImportApprovalLifecycle>;
  entry: SalesImportApprovalTransitionPlanEntry;
  request?: SalesImportApprovalRequest;
}) {
  const currentRequest = request ?? (await requestFor({ fixture, manifest }));
  if (entry.target === "RECORD") {
    return lifecycle.approveRecord({ ...currentRequest, recordId: entry.targetId });
  }
  if (entry.target === "SOURCE") {
    return lifecycle.approveSource({
      ...currentRequest,
      importSourceId: entry.targetId,
    });
  }
  return lifecycle.approveRun({ ...currentRequest, importRunId: entry.targetId });
}

async function approvePlanThrough({
  fixture,
  manifest,
  lifecycle,
  count = manifest.transitionPlan.length,
}: {
  fixture: Awaited<ReturnType<typeof createFixture>>;
  manifest: SalesImportApprovalManifest;
  lifecycle: ReturnType<typeof createSalesImportApprovalLifecycle>;
  count?: number;
}) {
  const evidence = [];
  for (const entry of manifest.transitionPlan.slice(0, count)) {
    evidence.push(await executeEntry({ fixture, manifest, lifecycle, entry }));
  }
  return evidence;
}

async function addValidRecord(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const source = fixture.sources[0];
  return prisma.canonicalSalesRecord.create({
    data: {
      id: "record-added",
      importRunId: fixture.run.id,
      importSourceId: source.id,
      businessKey: digest("business-added"),
      sourceHash: source.sourceHash,
      schemaVersion: "canonical-sales-v1",
      parserVersion: source.parserVersion,
      saleDate: new Date("2026-08-23T00:00:00.000Z"),
      productName: "Anonymous Product Added",
      originalProductName: "Anonymous Product Added",
      normalizedProductName: "Anonymous Product Added",
      quantity: 1,
      grossAmount: 1023,
      netAmount: 923,
      currency: "JPY",
      platform: "note",
      source: "note-sales-csv:v1",
      confidence: 0.99,
      validationJson: '{"ok":true,"issues":[]}',
      importedAt: fixture.run.importedAt,
      importedBy: fixture.run.importedBy,
    },
  });
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

test("builds a deterministic v3 immutable manifest with exact scope and plan", async () => {
  const fixture = await createFixture();
  const first = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const second = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.canonicalInput.manifestContractVersion, salesImportApprovalManifestContractVersion);
  assert.equal(first.canonicalInput.canonicalizationVersion, salesImportApprovalManifestCanonicalizationVersion);
  assert.deepEqual(first.canonicalInput.batchScope, { exactSourceCount: 2, exactRecordCount: 4 });
  assert.deepEqual(first.canonicalInput.staticInitialStateContract, {
    records: { approvalStatus: "PENDING", membership: "EXACT" },
    sources: { approvalStatus: "PENDING", membership: "EXACT" },
    importRun: { approvalStatus: "PENDING" },
    requiredApprovalAuditFieldsInitiallyUnset: [
      "reviewedAt",
      "reviewedBy",
      "reviewReason",
      "approvalFingerprint",
      "approvalFingerprintVersion",
      "approvalDecisionRef",
      "approvalAuthorityRole",
      "approvalAuthorityEvidenceDigest",
      "approvalVerifierId",
    ],
  });
  assert.equal(first.transitionPlan.length, 7);
  assert.deepEqual(first.transitionPlan.map(({ target }) => target), [
    "RECORD", "RECORD", "RECORD", "RECORD", "SOURCE", "SOURCE", "RUN",
  ]);
  assert.equal(first.transitionPlan[4].requiresApprovedRecordIds?.length, 2);
  assert.equal(first.transitionPlan[5].requiresApprovedRecordIds?.length, 2);
  assert.deepEqual(first.transitionPlan[6].requiresApprovedSourceIds, [
    "source-1",
    "source-2",
  ]);
});

for (const [runStatus, expected] of [
  ["completed", true],
  ["failed", false],
  ["review_required", false],
  ["COMPLETED", false],
] as const) {
  test(`v3 manifest readiness maps exact persisted ${runStatus} to ${expected}`, async () => {
    const fixture = await createFixture({ runStatus });
    const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
    const importRun = manifest.canonicalInput.importRun as {
      readiness: { runCompleted: boolean; lifecycleEligible: boolean };
    };
    assert.equal(importRun.readiness.runCompleted, expected);
    assert.equal(importRun.readiness.lifecycleEligible, expected);
  });
}

test("one CEO batch decision authorizes multiple Record transitions", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle, verifier } = createAuthorizedLifecycle(fixture, manifest);
  const records = manifest.transitionPlan.filter(({ target }) => target === "RECORD");
  const first = await executeEntry({ fixture, manifest, lifecycle, entry: records[0] });
  const second = await executeEntry({ fixture, manifest, lifecycle, entry: records[1] });
  assert.equal(first.approvalDecisionRef, decisionRef);
  assert.equal(second.approvalDecisionRef, decisionRef);
  assert.equal(verifier.calls.length, 2);
  assert.deepEqual(new Set(verifier.calls.map(({ decisionRef: value }) => value)), new Set([decisionRef]));
});

test("manifest stays stable while Transition-State changes after Record approval", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const evidence = await executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0] });
  const afterManifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  assert.equal(afterManifest.fingerprint, manifest.fingerprint);
  assert.notEqual(evidence.beforeTransitionStateFingerprint, evidence.afterTransitionStateFingerprint);
  assert.equal(evidence.approvalDecisionRef, decisionRef);
  assert.equal(evidence.manifestFingerprint, manifest.fingerprint);
  assert.equal(evidence.target, "RECORD");
  assert.equal(evidence.targetId, manifest.transitionPlan[0].targetId);
  assert.equal(evidence.transitionSequence, 1);
  assert.equal(evidence.result, "APPROVED");
});

test("next expected Transition-State succeeds and advances exactly one position", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const first = await executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0] });
  const state = await buildSalesImportApprovalTransitionState({
    prisma, importRunId: fixture.run.id, approvalManifestFingerprint: manifest.fingerprint, approvalDecisionRef: decisionRef,
  });
  assert.equal(state.fingerprint, first.afterTransitionStateFingerprint);
  assert.equal(state.nextTransition?.sequence, 2);
  const second = await executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[1] });
  assert.equal(second.transitionSequence, 2);
});

test("manifest remains unchanged through every valid Record, Source, and Run transition", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  for (const entry of manifest.transitionPlan) {
    await executeEntry({ fixture, manifest, lifecycle, entry });
    assert.equal(
      (await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id })).fingerprint,
      manifest.fingerprint,
    );
  }
});

test("unexpected Record status mutation blocks continuation", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  await executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0] });
  const state = await buildSalesImportApprovalTransitionState({
    prisma, importRunId: fixture.run.id, approvalManifestFingerprint: manifest.fingerprint, approvalDecisionRef: decisionRef,
  });
  await prisma.canonicalSalesRecord.update({
    where: { id: manifest.transitionPlan[1].targetId },
    data: { approvalStatus: ImportApprovalStatus.REVIEW_REQUIRED },
  });
  const request: SalesImportApprovalRequest = {
    approvalManifestFingerprint: manifest.fingerprint,
    approvalManifestContractVersion: salesImportApprovalManifestContractVersion,
    expectedTransitionStateFingerprint: state.fingerprint,
    authorization: { decisionRef, authorityEvidence },
    reason: "must block",
    reviewedAt,
  };
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[1], request }),
    /APPROVAL_TRANSITION_STATE_MISMATCH/,
  );
});

test("canonical Record business-content drift blocks continuation", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const request = await requestFor({ fixture, manifest });
  await prisma.canonicalSalesRecord.update({
    where: { id: manifest.transitionPlan[0].targetId },
    data: { grossAmount: { increment: 1 } },
  });
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0], request }),
    /APPROVAL_MANIFEST_MISMATCH/,
  );
});

test("SourceHash drift blocks continuation", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const request = await requestFor({ fixture, manifest });
  await prisma.importSource.update({ where: { id: fixture.sources[0].id }, data: { sourceHash: digest("mutated-source") } });
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0], request }),
    /APPROVAL_MANIFEST_MISMATCH/,
  );
});

test("added Record changes exact membership and blocks", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const request = await requestFor({ fixture, manifest });
  await addValidRecord(fixture);
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0], request }),
    /APPROVAL_MANIFEST_MISMATCH/,
  );
});

test("removed Record changes exact membership and blocks", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const request = await requestFor({ fixture, manifest });
  await prisma.canonicalSalesRecord.delete({ where: { id: manifest.transitionPlan[0].targetId } });
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[1], request }),
    /APPROVAL_MANIFEST_MISMATCH/,
  );
});

test("different decisionRef blocks an interrupted batch", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  await executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0] });
  const correctRequest = await requestFor({ fixture, manifest });
  await assert.rejects(
    executeEntry({
      fixture,
      manifest,
      lifecycle,
      entry: manifest.transitionPlan[1],
      request: {
        ...correctRequest,
        authorization: { decisionRef: "DEC-SALES-BATCH-DIFFERENT", authorityEvidence },
      },
    }),
    /BATCH_APPROVAL_DECISION_MISMATCH/,
  );
});

test("different Manifest fingerprint blocks with zero approval writes", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const before = await approvalSnapshot();
  await assert.rejects(
    executeEntry({
      fixture,
      manifest,
      lifecycle,
      entry: manifest.transitionPlan[0],
      request: await requestFor({ fixture, manifest, manifestFingerprint: "f".repeat(64) }),
    }),
    /APPROVAL_MANIFEST_MISMATCH/,
  );
  assert.deepEqual(await approvalSnapshot(), before);
});

test("authorized audit timestamp changes alter neither Manifest nor Transition-State", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  await executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0] });
  const beforeState = await buildSalesImportApprovalTransitionState({
    prisma, importRunId: fixture.run.id, approvalManifestFingerprint: manifest.fingerprint, approvalDecisionRef: decisionRef,
  });
  await prisma.canonicalSalesRecord.update({
    where: { id: manifest.transitionPlan[0].targetId },
    data: { reviewedAt: new Date("2026-09-02T02:00:00.000Z") },
  });
  const afterManifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const afterState = await buildSalesImportApprovalTransitionState({
    prisma, importRunId: fixture.run.id, approvalManifestFingerprint: manifest.fingerprint, approvalDecisionRef: decisionRef,
  });
  assert.equal(afterManifest.fingerprint, manifest.fingerprint);
  assert.equal(afterState.fingerprint, beforeState.fingerprint);
});

test("Source cannot approve before all Records and Run cannot approve before Sources", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const source = manifest.transitionPlan.find(({ target }) => target === "SOURCE")!;
  const run = manifest.transitionPlan.find(({ target }) => target === "RUN")!;
  const request = await requestFor({ fixture, manifest });
  await assert.rejects(executeEntry({ fixture, manifest, lifecycle, entry: source, request }), /UNEXPECTED_APPROVAL_TRANSITION_TARGET/);
  await assert.rejects(executeEntry({ fixture, manifest, lifecycle, entry: run, request }), /UNEXPECTED_APPROVAL_TRANSITION_TARGET/);
});

test("all approved entities persist the same Decision Ref and Manifest fingerprint", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  await approvePlanThrough({ fixture, manifest, lifecycle });
  const values = [
    ...(await prisma.canonicalSalesRecord.findMany()),
    ...(await prisma.importSource.findMany()),
    ...(await prisma.importRun.findMany()),
  ];
  assert.deepEqual(new Set(values.map(({ approvalDecisionRef }) => approvalDecisionRef)), new Set([decisionRef]));
  assert.deepEqual(new Set(values.map(({ approvalFingerprint }) => approvalFingerprint)), new Set([manifest.fingerprint]));
  assert.deepEqual(
    new Set(values.map(({ approvalFingerprintVersion }) => approvalFingerprintVersion)),
    new Set([salesImportApprovalManifestContractVersion]),
  );
});

test("the exact prior real v2 fingerprint and contract are rejected as v3 authorization", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const state = await buildSalesImportApprovalTransitionState({
    prisma, importRunId: fixture.run.id, approvalManifestFingerprint: manifest.fingerprint, approvalDecisionRef: decisionRef,
  });
  assert.throws(
    () => lifecycle.approveRecord({
      recordId: manifest.transitionPlan[0].targetId,
      approvalManifestFingerprint: "1ac00d3f8c72f1753c11e8abddcbd2054334a807828f99f514ea6338cc8cc1ae",
      approvalManifestContractVersion:
        historicalSalesImportApprovalFingerprintContractVersionV2,
      expectedTransitionStateFingerprint: state.fingerprint,
      authorization: { decisionRef, authorityEvidence },
      reason: "v2 is historical only",
    }),
    /requires sales-import-approval-manifest-sha256-canonical-json-v3/,
  );
});

test("unversioned verifier is rejected with zero writes", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const before = await approvalSnapshot();
  const verifier: SalesImportApprovalAuthorityVerifier = {
    async verify(request) {
      return {
        subjectId: "fixture-ceo-subject",
        authorityRole: "CEO",
        decisionRef: request.decisionRef,
        authorityEvidenceDigest: digest("fixture-authority"),
        verifierId: "isolated-fixture-verifier",
      };
    },
  };
  const lifecycle = createSalesImportApprovalLifecycle({ prisma, authorityVerifier: verifier });
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0] }),
    /versioned immutable identifier/,
  );
  assert.deepEqual(await approvalSnapshot(), before);
});

test("interrupted batch continues under the same Decision Ref and Manifest", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const firstRuntime = createAuthorizedLifecycle(fixture, manifest);
  await executeEntry({ fixture, manifest, lifecycle: firstRuntime.lifecycle, entry: manifest.transitionPlan[0] });
  const resumedRuntime = createAuthorizedLifecycle(fixture, manifest);
  const resumed = await executeEntry({ fixture, manifest, lifecycle: resumedRuntime.lifecycle, entry: manifest.transitionPlan[1] });
  assert.equal(resumed.approvalDecisionRef, decisionRef);
  assert.equal(resumed.manifestFingerprint, manifest.fingerprint);
  assert.equal(resumedRuntime.verifier.calls.length, 1);
});

test("interrupted batch rejects a different verifier identity binding", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const firstRuntime = createAuthorizedLifecycle(fixture, manifest);
  await executeEntry({ fixture, manifest, lifecycle: firstRuntime.lifecycle, entry: manifest.transitionPlan[0] });
  const approved = await prisma.canonicalSalesRecord.findUniqueOrThrow({
    where: { id: manifest.transitionPlan[0].targetId },
  });
  const changedVerifier: SalesImportApprovalAuthorityVerifier = {
    async verify(request) {
      return {
        subjectId: approved.reviewedBy!,
        authorityRole: "CEO",
        decisionRef: request.decisionRef,
        authorityEvidenceDigest: approved.approvalAuthorityEvidenceDigest!,
        verifierId: "different-fixture-verifier-v2",
      };
    },
  };
  const lifecycle = createSalesImportApprovalLifecycle({
    prisma,
    authorityVerifier: changedVerifier,
  });
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[1] }),
    /BATCH_APPROVAL_AUTHORITY_BINDING_MISMATCH/,
  );
});

test("business drift after interruption blocks continuation", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  await executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0] });
  const state = await buildSalesImportApprovalTransitionState({
    prisma, importRunId: fixture.run.id, approvalManifestFingerprint: manifest.fingerprint, approvalDecisionRef: decisionRef,
  });
  await prisma.canonicalSalesRecord.update({
    where: { id: manifest.transitionPlan[1].targetId },
    data: { quantity: { increment: 1 } },
  });
  const request: SalesImportApprovalRequest = {
    approvalManifestFingerprint: manifest.fingerprint,
    approvalManifestContractVersion: salesImportApprovalManifestContractVersion,
    expectedTransitionStateFingerprint: state.fingerprint,
    authorization: { decisionRef, authorityEvidence },
    reason: "must block",
    reviewedAt,
  };
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[1], request }),
    /APPROVAL_MANIFEST_MISMATCH/,
  );
});

test("initial approval-state mismatch fails before the first write", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  await prisma.canonicalSalesRecord.update({ where: { id: manifest.transitionPlan[0].targetId }, data: { reviewedAt } });
  await assert.rejects(
    lifecycle.approveRecord({
      recordId: manifest.transitionPlan[0].targetId,
      approvalManifestFingerprint: manifest.fingerprint,
      approvalManifestContractVersion: salesImportApprovalManifestContractVersion,
      expectedTransitionStateFingerprint: "a".repeat(64),
      authorization: { decisionRef, authorityEvidence },
      reason: "must fail initial state",
    }),
    /INITIAL_APPROVAL_STATE_MISMATCH/,
  );
  assert.equal(await prisma.canonicalSalesRecord.count({ where: { approvalStatus: ImportApprovalStatus.APPROVED } }), 0);
});

test("transition fingerprint mismatch performs zero writes", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const before = await approvalSnapshot();
  await assert.rejects(
    lifecycle.approveRecord({
      ...(await requestFor({ fixture, manifest })),
      recordId: manifest.transitionPlan[0].targetId,
      expectedTransitionStateFingerprint: "f".repeat(64),
    }),
    /APPROVAL_TRANSITION_STATE_FINGERPRINT_MISMATCH/,
  );
  assert.deepEqual(await approvalSnapshot(), before);
});

test("idempotent retry returns evidence without changing Transition-State", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  const firstEntry = manifest.transitionPlan[0];
  await executeEntry({ fixture, manifest, lifecycle, entry: firstEntry });
  const retry = await executeEntry({ fixture, manifest, lifecycle, entry: firstEntry });
  assert.equal(retry.result, "ALREADY_APPROVED");
  assert.equal(retry.beforeTransitionStateFingerprint, retry.afterTransitionStateFingerprint);
});

test("runtime CEO binding remains unavailable and caller claims cannot authorize", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const lifecycle = createSalesImportApprovalLifecycle({ prisma, authorityVerifier: unavailableRuntimeCeoAuthorityVerifier });
  await assert.rejects(
    lifecycle.approveRecord({
      ...(await requestFor({ fixture, manifest })),
      recordId: manifest.transitionPlan[0].targetId,
      authorization: { decisionRef, authorityEvidence, claimedAuthorityRole: "CEO" },
    }),
    /RUNTIME CEO AUTHORITY BINDING: UNRESOLVED/,
  );
});

test("invalid Record validation blocks the batch before approval writes", async () => {
  const fixture = await createFixture({ invalidRecord: true });
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  await assert.rejects(
    executeEntry({ fixture, manifest, lifecycle, entry: manifest.transitionPlan[0] }),
    /SALES_IMPORT_APPROVAL_MANIFEST_NOT_READY/,
  );
  assert.equal(await prisma.canonicalSalesRecord.count({ where: { approvalStatus: ImportApprovalStatus.APPROVED } }), 0);
});

test("batch audit is complete and Data Layer Promotion records remain untouched", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const { lifecycle } = createAuthorizedLifecycle(fixture, manifest);
  await approvePlanThrough({ fixture, manifest, lifecycle });
  const values = [
    ...(await prisma.canonicalSalesRecord.findMany()),
    ...(await prisma.importSource.findMany()),
    ...(await prisma.importRun.findMany()),
  ];
  for (const value of values) {
    assert.equal(value.approvalStatus, ImportApprovalStatus.APPROVED);
    assert.equal(value.reviewedBy, "fixture-ceo-subject");
    assert.equal(value.approvalDecisionRef, decisionRef);
    assert.equal(value.approvalFingerprint, manifest.fingerprint);
    assert.equal(value.approvalFingerprintVersion, salesImportApprovalManifestContractVersion);
    assert.equal(value.approvalAuthorityRole, "CEO");
    assert.match(value.approvalAuthorityEvidenceDigest ?? "", /^[a-f0-9]{64}$/);
    assert.equal(value.approvalVerifierId, "isolated-fixture-verifier-v1");
  }
  assert.equal(await prisma.sale.count(), 0);
  assert.equal(await prisma.saleItem.count(), 0);
  assert.equal(await prisma.promotionRun.count(), 0);
});

test("v3 Transition-State contract identifiers are exact", async () => {
  const fixture = await createFixture();
  const manifest = await buildSalesImportApprovalManifest({ prisma, importRunId: fixture.run.id });
  const state = await buildSalesImportApprovalTransitionState({
    prisma, importRunId: fixture.run.id, approvalManifestFingerprint: manifest.fingerprint, approvalDecisionRef: decisionRef,
  });
  assert.equal(state.canonicalInput.transitionStateContractVersion, salesImportApprovalTransitionStateContractVersion);
  assert.equal(state.canonicalInput.canonicalizationVersion, salesImportApprovalTransitionStateCanonicalizationVersion);
  assert.equal(state.nextTransition?.sequence, 1);
});
