import { createHash } from "node:crypto";
import {
  ImportApprovalStatus,
  type CanonicalSalesRecord,
  type ImportRun,
  type ImportSource,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

export const salesImportApprovalCanonicalizationVersion =
  "sales-import-approval-canonical-json-v2";
export const salesImportApprovalFingerprintAlgorithm = "SHA-256";
export const salesImportApprovalFingerprintContractVersion =
  "sales-import-approval-sha256-canonical-json-v2";
export const historicalSalesImportApprovalFingerprintContractVersionV1 =
  "sales-import-approval-sha256-canonical-json-v1";
export const salesImportApprovalReadinessContractVersion =
  "sales-import-approval-readiness-v2";

export const canonicalPersistentImportRunStatusContract = Object.freeze({
  completed: "completed",
  failed: "failed",
  reviewRequired: "review_required",
  exactMatch: true,
  normalization: "none",
});

export type SalesImportApprovalTarget = "RECORD" | "SOURCE" | "RUN";

export type SalesImportApprovalAuthorization = {
  decisionRef: string;
  authorityEvidence: unknown;
  claimedAuthorityRole?: string;
};

export type SalesImportAuthorityVerificationRequest = {
  purpose: "SALES_IMPORT_APPROVAL";
  target: SalesImportApprovalTarget;
  targetId: string;
  importRunId: string;
  approvalFingerprint: string;
  fingerprintVersion: string;
  decisionRef: string;
  authorityEvidence: unknown;
};

export type VerifiedSalesImportApprovalAuthority = {
  subjectId: string;
  authorityRole: "CEO";
  decisionRef: string;
  authorityEvidenceDigest: string;
  verifierId: string;
};

export interface SalesImportApprovalAuthorityVerifier {
  verify(
    request: SalesImportAuthorityVerificationRequest,
  ): Promise<VerifiedSalesImportApprovalAuthority>;
}

export const unavailableRuntimeCeoAuthorityVerifier: SalesImportApprovalAuthorityVerifier =
  Object.freeze({
    async verify(): Promise<never> {
      throw new Error("RUNTIME CEO AUTHORITY BINDING: UNRESOLVED");
    },
  });

type ApprovalStore = PrismaClient | Prisma.TransactionClient;

type ApprovalGraph = ImportRun & {
  sources: ImportSource[];
  canonicalSalesRecords: CanonicalSalesRecord[];
};

export type SalesImportApprovalFingerprint = {
  fingerprint: string;
  canonicalInput: Record<string, unknown>;
};

export type SalesImportApprovalRequest = {
  expectedFingerprint: string;
  expectedFingerprintContractVersion: string;
  authorization: SalesImportApprovalAuthorization;
  reason: string;
  reviewedAt?: Date;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assertNonEmpty(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} is required`);
}

function assertSha256(value: string, field: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256 digest`);
  }
}

function assertVersionedVerifierId(value: string) {
  assertNonEmpty(value, "verifierId");
  if (!/^[a-z0-9][a-z0-9._-]*-v[1-9][0-9]*$/.test(value)) {
    throw new Error("verifierId must be a versioned immutable identifier");
  }
}

function assertCurrentFingerprintContractVersion(value: string) {
  if (value !== salesImportApprovalFingerprintContractVersion) {
    throw new Error(
      `Sales Import approval authorization requires ${salesImportApprovalFingerprintContractVersion}`,
    );
  }
}

function toIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number in canonical input");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`)
      .join(",")}}`;
  }
  throw new Error("Unsupported value in canonical input");
}

function jsonEvidence(raw: string) {
  const rawDigest = sha256(raw);
  try {
    const parsed = JSON.parse(raw) as unknown;
    return {
      validJson: true,
      rawDigest,
      canonicalDigest: sha256(stableSerialize(parsed)),
      parsed,
    };
  } catch {
    return {
      validJson: false,
      rawDigest,
      canonicalDigest: null,
      parsed: null,
    };
  }
}

function validationOk(record: CanonicalSalesRecord) {
  const evidence = jsonEvidence(record.validationJson);
  return (
    evidence.validJson &&
    typeof evidence.parsed === "object" &&
    evidence.parsed !== null &&
    (evidence.parsed as { ok?: unknown }).ok === true
  );
}

async function loadApprovalGraph(
  store: ApprovalStore,
  importRunId: string,
): Promise<ApprovalGraph> {
  const graph = await store.importRun.findUnique({
    where: { id: importRunId },
    include: {
      sources: true,
      canonicalSalesRecords: true,
    },
  });
  if (!graph) throw new Error("ImportRun not found");
  return graph;
}

function approvalEvidenceFields(
  value: ImportRun | ImportSource | CanonicalSalesRecord,
) {
  return {
    approvalStatus: value.approvalStatus,
    reviewedAt: toIso(value.reviewedAt),
    reviewedBy: value.reviewedBy,
    reviewReason: value.reviewReason,
    approvalFingerprint: value.approvalFingerprint,
    approvalFingerprintVersion: value.approvalFingerprintVersion,
    approvalDecisionRef: value.approvalDecisionRef,
    approvalAuthorityRole: value.approvalAuthorityRole,
    approvalAuthorityEvidenceDigest: value.approvalAuthorityEvidenceDigest,
    approvalVerifierId: value.approvalVerifierId,
  };
}

export async function buildSalesImportApprovalFingerprint({
  prisma,
  importRunId,
}: {
  prisma: ApprovalStore;
  importRunId: string;
}): Promise<SalesImportApprovalFingerprint> {
  const graph = await loadApprovalGraph(prisma, importRunId);
  const sources = [...graph.sources].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const records = [...graph.canonicalSalesRecords].sort(
    (left, right) =>
      left.businessKey.localeCompare(right.businessKey) ||
      left.id.localeCompare(right.id),
  );
  const sourceIds = new Set(sources.map(({ id }) => id));
  const recordsBySource = new Map<string, CanonicalSalesRecord[]>();
  for (const record of records) {
    const current = recordsBySource.get(record.importSourceId) ?? [];
    current.push(record);
    recordsBySource.set(record.importSourceId, current);
  }

  const sourceInput = sources.map((source) => {
    const metadata = jsonEvidence(source.metadataJson);
    return {
      id: source.id,
      importRunId: source.importRunId,
      sourceType: source.sourceType,
      sourceFile: source.sourceFile,
      sourceHash: source.sourceHash,
      parserVersion: source.parserVersion,
      confidence: source.confidence,
      metadataRawDigest: metadata.rawDigest,
      metadataCanonicalDigest: metadata.canonicalDigest,
      metadataValidJson: metadata.validJson,
      childRecordIds: (recordsBySource.get(source.id) ?? []).map(({ id }) => id),
      ...approvalEvidenceFields(source),
      createdAt: source.createdAt.toISOString(),
    };
  });

  const recordInput = records.map((record) => {
    const validation = jsonEvidence(record.validationJson);
    const canonicalContent = {
      saleDate: record.saleDate.toISOString(),
      productName: record.productName,
      originalProductName: record.originalProductName,
      normalizedProductName: record.normalizedProductName,
      candidateArticleId: record.candidateArticleId,
      candidateProductId: record.candidateProductId,
      matchConfidence: record.matchConfidence,
      quantity: record.quantity,
      grossAmount: record.grossAmount,
      netAmount: record.netAmount,
      currency: record.currency,
      platform: record.platform,
      source: record.source,
      confidence: record.confidence,
    };
    return {
      id: record.id,
      importRunId: record.importRunId,
      importSourceId: record.importSourceId,
      businessKey: record.businessKey,
      sourceHash: record.sourceHash,
      schemaVersion: record.schemaVersion,
      parserVersion: record.parserVersion,
      canonicalContentDigest: sha256(stableSerialize(canonicalContent)),
      validationRawDigest: validation.rawDigest,
      validationCanonicalDigest: validation.canonicalDigest,
      validationValidJson: validation.validJson,
      validationOk: validationOk(record),
      importedAt: record.importedAt.toISOString(),
      importedBy: record.importedBy,
      ...approvalEvidenceFields(record),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  });

  const allRecordsValid = records.every(validationOk);
  const traceabilityValid =
    sources.every((source) => source.importRunId === graph.id) &&
    records.every(
      (record) =>
        record.importRunId === graph.id &&
        sourceIds.has(record.importSourceId) &&
        sources.find(({ id }) => id === record.importSourceId)?.sourceHash ===
          record.sourceHash,
    );
  const everySourceHasRecords = sources.every(
    (source) => (recordsBySource.get(source.id)?.length ?? 0) > 0,
  );
  const allRecordsApproved = records.every(
    ({ approvalStatus }) => approvalStatus === ImportApprovalStatus.APPROVED,
  );
  const allSourcesApproved = sources.every(
    ({ approvalStatus }) => approvalStatus === ImportApprovalStatus.APPROVED,
  );
  const lifecycleEligible =
    graph.status === canonicalPersistentImportRunStatusContract.completed &&
    sources.length > 0 &&
    records.length > 0 &&
    everySourceHasRecords &&
    allRecordsValid &&
    traceabilityValid;

  const summary = graph.summaryJson ? jsonEvidence(graph.summaryJson) : null;
  const canonicalInput: Record<string, unknown> = {
    fingerprintContractVersion: salesImportApprovalFingerprintContractVersion,
    fingerprintAlgorithm: salesImportApprovalFingerprintAlgorithm,
    canonicalizationVersion: salesImportApprovalCanonicalizationVersion,
    persistentRunStatusContract: canonicalPersistentImportRunStatusContract,
    readinessContractVersion: salesImportApprovalReadinessContractVersion,
    importRun: {
      id: graph.id,
      status: graph.status,
      startedAt: graph.startedAt.toISOString(),
      completedAt: toIso(graph.completedAt),
      importedAt: graph.importedAt.toISOString(),
      importedBy: graph.importedBy,
      pipelineVersion: graph.pipelineVersion,
      summaryRawDigest: summary?.rawDigest ?? null,
      summaryCanonicalDigest: summary?.canonicalDigest ?? null,
      summaryValidJson: summary?.validJson ?? null,
      error: graph.error,
      importMode: graph.importMode,
      ...approvalEvidenceFields(graph),
      createdAt: graph.createdAt.toISOString(),
      updatedAt: graph.updatedAt.toISOString(),
    },
    orderedSources: sourceInput,
    orderedCanonicalSalesRecords: recordInput,
    readiness: {
      runCompleted:
        graph.status === canonicalPersistentImportRunStatusContract.completed,
      sourceCount: sources.length,
      recordCount: records.length,
      everySourceHasRecords,
      allRecordsValid,
      traceabilityValid,
      allRecordsApproved,
      allSourcesApproved,
      lifecycleEligible,
      readyForSourceApproval: lifecycleEligible && allRecordsApproved,
      readyForRunApproval:
        lifecycleEligible && allRecordsApproved && allSourcesApproved,
      readyForDataLayerPromotion:
        lifecycleEligible &&
        allRecordsApproved &&
        allSourcesApproved &&
        graph.approvalStatus === ImportApprovalStatus.APPROVED,
    },
  };

  return {
    fingerprint: sha256(stableSerialize(canonicalInput)),
    canonicalInput,
  };
}

async function verifyAuthority({
  verifier,
  authorization,
  target,
  targetId,
  importRunId,
  fingerprint,
}: {
  verifier: SalesImportApprovalAuthorityVerifier;
  authorization: SalesImportApprovalAuthorization;
  target: SalesImportApprovalTarget;
  targetId: string;
  importRunId: string;
  fingerprint: string;
}) {
  assertNonEmpty(authorization.decisionRef, "decisionRef");
  if (authorization.authorityEvidence === undefined) {
    throw new Error("authorityEvidence is required");
  }
  const verified = await verifier.verify({
    purpose: "SALES_IMPORT_APPROVAL",
    target,
    targetId,
    importRunId,
    approvalFingerprint: fingerprint,
    fingerprintVersion: salesImportApprovalFingerprintContractVersion,
    decisionRef: authorization.decisionRef,
    authorityEvidence: authorization.authorityEvidence,
  });
  if (verified.authorityRole !== "CEO") {
    throw new Error("Sales Import approval requires verified CEO authority");
  }
  assertNonEmpty(verified.subjectId, "verified subjectId");
  assertVersionedVerifierId(verified.verifierId);
  assertSha256(verified.authorityEvidenceDigest, "authorityEvidenceDigest");
  if (verified.decisionRef !== authorization.decisionRef) {
    throw new Error("Verified decision reference does not match the request");
  }
  return verified;
}

function assertFingerprint(current: string, expected: string) {
  assertSha256(expected, "expectedFingerprint");
  if (current !== expected) {
    throw new Error("Sales Import approval fingerprint mismatch");
  }
}

function approvalAuditData({
  fingerprint,
  verified,
  reason,
  reviewedAt,
}: {
  fingerprint: string;
  verified: VerifiedSalesImportApprovalAuthority;
  reason: string;
  reviewedAt: Date;
}) {
  assertNonEmpty(reason, "reason");
  return {
    approvalStatus: ImportApprovalStatus.APPROVED,
    reviewedAt,
    reviewedBy: verified.subjectId,
    reviewReason: reason.trim(),
    approvalFingerprint: fingerprint,
    approvalFingerprintVersion: salesImportApprovalFingerprintContractVersion,
    approvalDecisionRef: verified.decisionRef,
    approvalAuthorityRole: verified.authorityRole,
    approvalAuthorityEvidenceDigest: verified.authorityEvidenceDigest,
    approvalVerifierId: verified.verifierId,
  };
}

export function createSalesImportApprovalLifecycle({
  prisma,
  authorityVerifier,
}: {
  prisma: PrismaClient;
  authorityVerifier: SalesImportApprovalAuthorityVerifier;
}) {
  return {
    approveRecord({
      recordId,
      expectedFingerprint,
      expectedFingerprintContractVersion,
      authorization,
      reason,
      reviewedAt = new Date(),
    }: SalesImportApprovalRequest & { recordId: string }) {
      assertCurrentFingerprintContractVersion(expectedFingerprintContractVersion);
      return prisma.$transaction(async (transaction) => {
        const record = await transaction.canonicalSalesRecord.findUnique({
          where: { id: recordId },
        });
        if (!record) throw new Error("Canonical Sales Record not found");
        const current = await buildSalesImportApprovalFingerprint({
          prisma: transaction,
          importRunId: record.importRunId,
        });
        assertFingerprint(current.fingerprint, expectedFingerprint);
        if (!validationOk(record)) {
          throw new Error("Invalid Canonical Sale cannot be APPROVED");
        }
        if (record.approvalStatus === ImportApprovalStatus.REJECTED) {
          throw new Error("REJECTED Canonical Sales Record cannot be APPROVED");
        }
        const verified = await verifyAuthority({
          verifier: authorityVerifier,
          authorization,
          target: "RECORD",
          targetId: record.id,
          importRunId: record.importRunId,
          fingerprint: current.fingerprint,
        });
        if (record.approvalStatus === ImportApprovalStatus.APPROVED) return record;
        return transaction.canonicalSalesRecord.update({
          where: { id: record.id },
          data: approvalAuditData({
            fingerprint: current.fingerprint,
            verified,
            reason,
            reviewedAt,
          }),
        });
      });
    },

    approveSource({
      importSourceId,
      expectedFingerprint,
      expectedFingerprintContractVersion,
      authorization,
      reason,
      reviewedAt = new Date(),
    }: SalesImportApprovalRequest & { importSourceId: string }) {
      assertCurrentFingerprintContractVersion(expectedFingerprintContractVersion);
      return prisma.$transaction(async (transaction) => {
        const source = await transaction.importSource.findUnique({
          where: { id: importSourceId },
          include: { canonicalSalesRecords: true },
        });
        if (!source) throw new Error("ImportSource not found");
        const current = await buildSalesImportApprovalFingerprint({
          prisma: transaction,
          importRunId: source.importRunId,
        });
        assertFingerprint(current.fingerprint, expectedFingerprint);
        if (
          source.canonicalSalesRecords.length === 0 ||
          source.canonicalSalesRecords.some(
            ({ approvalStatus }) =>
              approvalStatus !== ImportApprovalStatus.APPROVED,
          )
        ) {
          throw new Error(
            "ImportSource approval requires every child Canonical Sales Record to be APPROVED",
          );
        }
        if (source.approvalStatus === ImportApprovalStatus.REJECTED) {
          throw new Error("REJECTED ImportSource cannot be APPROVED");
        }
        const verified = await verifyAuthority({
          verifier: authorityVerifier,
          authorization,
          target: "SOURCE",
          targetId: source.id,
          importRunId: source.importRunId,
          fingerprint: current.fingerprint,
        });
        if (source.approvalStatus === ImportApprovalStatus.APPROVED) return source;
        if (source.approvalStatus !== ImportApprovalStatus.PENDING) {
          throw new Error(
            `Invalid ImportSource approval transition: ${source.approvalStatus} -> APPROVED`,
          );
        }
        return transaction.importSource.update({
          where: { id: source.id },
          data: approvalAuditData({
            fingerprint: current.fingerprint,
            verified,
            reason,
            reviewedAt,
          }),
        });
      });
    },

    approveRun({
      importRunId,
      expectedFingerprint,
      expectedFingerprintContractVersion,
      authorization,
      reason,
      reviewedAt = new Date(),
    }: SalesImportApprovalRequest & { importRunId: string }) {
      assertCurrentFingerprintContractVersion(expectedFingerprintContractVersion);
      return prisma.$transaction(async (transaction) => {
        const run = await transaction.importRun.findUnique({
          where: { id: importRunId },
          include: { sources: true },
        });
        if (!run) throw new Error("ImportRun not found");
        const current = await buildSalesImportApprovalFingerprint({
          prisma: transaction,
          importRunId: run.id,
        });
        assertFingerprint(current.fingerprint, expectedFingerprint);
        if (
          run.status !== canonicalPersistentImportRunStatusContract.completed ||
          run.sources.length === 0 ||
          run.sources.some(
            ({ approvalStatus }) =>
              approvalStatus !== ImportApprovalStatus.APPROVED,
          )
        ) {
          throw new Error(
            "ImportRun approval requires canonical completed status and every ImportSource to be APPROVED",
          );
        }
        if (run.approvalStatus === ImportApprovalStatus.REJECTED) {
          throw new Error("REJECTED ImportRun cannot be APPROVED");
        }
        const verified = await verifyAuthority({
          verifier: authorityVerifier,
          authorization,
          target: "RUN",
          targetId: run.id,
          importRunId: run.id,
          fingerprint: current.fingerprint,
        });
        if (run.approvalStatus === ImportApprovalStatus.APPROVED) return run;
        if (run.approvalStatus !== ImportApprovalStatus.PENDING) {
          throw new Error(
            `Invalid ImportRun approval transition: ${run.approvalStatus} -> APPROVED`,
          );
        }
        return transaction.importRun.update({
          where: { id: run.id },
          data: approvalAuditData({
            fingerprint: current.fingerprint,
            verified,
            reason,
            reviewedAt,
          }),
        });
      });
    },
  };
}
