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
export const historicalSalesImportApprovalFingerprintContractVersionV2 =
  salesImportApprovalFingerprintContractVersion;
export const salesImportApprovalReadinessContractVersion =
  "sales-import-approval-readiness-v2";
export const salesImportApprovalManifestCanonicalizationVersion =
  "sales-import-approval-manifest-canonical-json-v3";
export const salesImportApprovalManifestContractVersion =
  "sales-import-approval-manifest-sha256-canonical-json-v3";
export const salesImportApprovalTransitionStateCanonicalizationVersion =
  "sales-import-approval-transition-state-canonical-json-v3";
export const salesImportApprovalTransitionStateContractVersion =
  "sales-import-approval-transition-state-sha256-canonical-json-v3";
export const salesImportApprovalManifestReadinessContractVersion =
  "sales-import-approval-readiness-v3";

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
  approvalManifestFingerprint: string;
  manifestContractVersion: string;
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
  approvalManifestFingerprint: string;
  approvalManifestContractVersion: string;
  expectedTransitionStateFingerprint: string;
  authorization: SalesImportApprovalAuthorization;
  reason: string;
  reviewedAt?: Date;
};

export type SalesImportApprovalTransitionPlanEntry = {
  sequence: number;
  target: SalesImportApprovalTarget;
  targetId: string;
  from: "PENDING";
  to: "APPROVED";
  requiresApprovedRecordIds?: string[];
  requiresApprovedSourceIds?: string[];
};

export type SalesImportApprovalManifest = {
  fingerprint: string;
  canonicalInput: Record<string, unknown>;
  transitionPlan: SalesImportApprovalTransitionPlanEntry[];
};

type SalesImportBatchAuthorityBinding = {
  subjectId: string;
  authorityRole: "CEO";
  authorityEvidenceDigest: string;
  verifierId: string;
};

export type SalesImportApprovalTransitionState = {
  fingerprint: string;
  canonicalInput: Record<string, unknown>;
  completedTransitionCount: number;
  nextTransition: SalesImportApprovalTransitionPlanEntry | null;
  authorityBinding: SalesImportBatchAuthorityBinding | null;
};

export type SalesImportApprovalExecutionEvidence = {
  approvalDecisionRef: string;
  manifestFingerprint: string;
  target: SalesImportApprovalTarget;
  targetId: string;
  transitionSequence: number;
  beforeTransitionStateFingerprint: string;
  afterTransitionStateFingerprint: string;
  result: "APPROVED" | "ALREADY_APPROVED";
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

function assertCurrentManifestContractVersion(value: string) {
  if (value !== salesImportApprovalManifestContractVersion) {
    throw new Error(
      `Sales Import approval authorization requires ${salesImportApprovalManifestContractVersion}`,
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

const requiredInitialApprovalAuditFields = Object.freeze([
  "reviewedAt",
  "reviewedBy",
  "reviewReason",
  "approvalFingerprint",
  "approvalFingerprintVersion",
  "approvalDecisionRef",
  "approvalAuthorityRole",
  "approvalAuthorityEvidenceDigest",
  "approvalVerifierId",
] as const);

type ApprovalEntity = ImportRun | ImportSource | CanonicalSalesRecord;

function sortedApprovalGraph(graph: ApprovalGraph) {
  return {
    sources: [...graph.sources].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    records: [...graph.canonicalSalesRecords].sort(
      (left, right) =>
        left.businessKey.localeCompare(right.businessKey) ||
        left.id.localeCompare(right.id),
    ),
  };
}

function canonicalRecordContentDigest(record: CanonicalSalesRecord) {
  return sha256(
    stableSerialize({
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
    }),
  );
}

function createSalesImportApprovalManifest(
  graph: ApprovalGraph,
): SalesImportApprovalManifest {
  const { sources, records } = sortedApprovalGraph(graph);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const recordsBySource = new Map<string, CanonicalSalesRecord[]>();
  for (const record of records) {
    const current = recordsBySource.get(record.importSourceId) ?? [];
    current.push(record);
    recordsBySource.set(record.importSourceId, current);
  }

  const sourceInput = sources.map((source) => {
    const metadata = jsonEvidence(source.metadataJson);
    const children = recordsBySource.get(source.id) ?? [];
    const traceabilityValid =
      source.importRunId === graph.id &&
      children.every(
        (record) =>
          record.importRunId === graph.id &&
          record.sourceHash === source.sourceHash &&
          record.parserVersion === source.parserVersion,
      );
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
      childRecordIds: children.map(({ id }) => id),
      readiness: {
        childRecordCount: children.length,
        allChildRecordsValid: children.length > 0 && children.every(validationOk),
        traceabilityValid,
      },
      createdAt: source.createdAt.toISOString(),
    };
  });

  const recordInput = records.map((record) => {
    const validation = jsonEvidence(record.validationJson);
    return {
      id: record.id,
      importRunId: record.importRunId,
      importSourceId: record.importSourceId,
      businessKey: record.businessKey,
      sourceHash: record.sourceHash,
      schemaVersion: record.schemaVersion,
      parserVersion: record.parserVersion,
      canonicalBusinessContentDigest: canonicalRecordContentDigest(record),
      validationRawDigest: validation.rawDigest,
      validationCanonicalDigest: validation.canonicalDigest,
      validationValidJson: validation.validJson,
      validationOk: validationOk(record),
      importedAt: record.importedAt.toISOString(),
      importedBy: record.importedBy,
      createdAt: record.createdAt.toISOString(),
    };
  });

  const sourceIds = new Set(sources.map(({ id }) => id));
  const allRecordsValid = records.every(validationOk);
  const traceabilityValid =
    sources.every(({ importRunId }) => importRunId === graph.id) &&
    records.every((record) => {
      const source = sourceById.get(record.importSourceId);
      return (
        record.importRunId === graph.id &&
        sourceIds.has(record.importSourceId) &&
        source?.sourceHash === record.sourceHash &&
        source.parserVersion === record.parserVersion
      );
    });
  const everySourceHasRecords = sources.every(
    ({ id }) => (recordsBySource.get(id)?.length ?? 0) > 0,
  );
  const runCompleted =
    graph.status === canonicalPersistentImportRunStatusContract.completed;
  const lifecycleEligible =
    runCompleted &&
    sources.length > 0 &&
    records.length > 0 &&
    everySourceHasRecords &&
    allRecordsValid &&
    traceabilityValid;
  const summary = graph.summaryJson ? jsonEvidence(graph.summaryJson) : null;

  // The immutable manifest excludes approval/audit values and mutable updatedAt fields.
  const transitionPlan: SalesImportApprovalTransitionPlanEntry[] = [];
  for (const record of records) {
    transitionPlan.push({
      sequence: transitionPlan.length + 1,
      target: "RECORD",
      targetId: record.id,
      from: "PENDING",
      to: "APPROVED",
    });
  }
  for (const source of sources) {
    transitionPlan.push({
      sequence: transitionPlan.length + 1,
      target: "SOURCE",
      targetId: source.id,
      from: "PENDING",
      to: "APPROVED",
      requiresApprovedRecordIds: (recordsBySource.get(source.id) ?? []).map(
        ({ id }) => id,
      ),
    });
  }
  transitionPlan.push({
    sequence: transitionPlan.length + 1,
    target: "RUN",
    targetId: graph.id,
    from: "PENDING",
    to: "APPROVED",
    requiresApprovedSourceIds: sources.map(({ id }) => id),
  });

  const canonicalInput: Record<string, unknown> = {
    manifestContractVersion: salesImportApprovalManifestContractVersion,
    fingerprintAlgorithm: salesImportApprovalFingerprintAlgorithm,
    canonicalizationVersion: salesImportApprovalManifestCanonicalizationVersion,
    readinessContractVersion:
      salesImportApprovalManifestReadinessContractVersion,
    persistentRunStatusContract: canonicalPersistentImportRunStatusContract,
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
      createdAt: graph.createdAt.toISOString(),
      readiness: {
        runCompleted,
        sourceCount: sources.length,
        recordCount: records.length,
        everySourceHasRecords,
        allRecordsValid,
        traceabilityValid,
        lifecycleEligible,
      },
    },
    orderedSources: sourceInput,
    orderedCanonicalSalesRecords: recordInput,
    batchScope: {
      exactSourceCount: sources.length,
      exactRecordCount: records.length,
    },
    staticInitialStateContract: {
      records: { approvalStatus: "PENDING", membership: "EXACT" },
      sources: { approvalStatus: "PENDING", membership: "EXACT" },
      importRun: { approvalStatus: "PENDING" },
      requiredApprovalAuditFieldsInitiallyUnset:
        requiredInitialApprovalAuditFields,
    },
    transitionPlan: {
      ordering: "ALL_RECORDS_THEN_ALL_SOURCES_THEN_IMPORT_RUN",
      parentGates: {
        source: "ALL_IN_SCOPE_CHILD_RECORDS_APPROVED",
        run: "ALL_IN_SCOPE_SOURCES_APPROVED",
      },
      orderedTransitions: transitionPlan,
    },
  };

  return {
    fingerprint: sha256(stableSerialize(canonicalInput)),
    canonicalInput,
    transitionPlan,
  };
}

export async function buildSalesImportApprovalManifest({
  prisma,
  importRunId,
}: {
  prisma: ApprovalStore;
  importRunId: string;
}): Promise<SalesImportApprovalManifest> {
  return createSalesImportApprovalManifest(
    await loadApprovalGraph(prisma, importRunId),
  );
}

function approvalAuditFieldsUnset(value: ApprovalEntity) {
  return requiredInitialApprovalAuditFields.every((field) => value[field] === null);
}

function approvalEntityForTransition(
  graph: ApprovalGraph,
  entry: SalesImportApprovalTransitionPlanEntry,
) {
  if (entry.target === "RUN") return graph;
  if (entry.target === "SOURCE") {
    return graph.sources.find(({ id }) => id === entry.targetId) ?? null;
  }
  return (
    graph.canonicalSalesRecords.find(({ id }) => id === entry.targetId) ?? null
  );
}

function completeApprovedAuditBinding(value: ApprovalEntity) {
  return (
    value.reviewedAt !== null &&
    typeof value.reviewedBy === "string" &&
    value.reviewedBy.trim().length > 0 &&
    typeof value.reviewReason === "string" &&
    value.reviewReason.trim().length > 0 &&
    value.approvalAuthorityRole === "CEO" &&
    typeof value.approvalAuthorityEvidenceDigest === "string" &&
    /^[a-f0-9]{64}$/.test(value.approvalAuthorityEvidenceDigest) &&
    typeof value.approvalVerifierId === "string" &&
    /^[a-z0-9][a-z0-9._-]*-v[1-9][0-9]*$/.test(value.approvalVerifierId)
  );
}

function authorityBindingFrom(value: ApprovalEntity): SalesImportBatchAuthorityBinding {
  return {
    subjectId: value.reviewedBy!,
    authorityRole: "CEO",
    authorityEvidenceDigest: value.approvalAuthorityEvidenceDigest!,
    verifierId: value.approvalVerifierId!,
  };
}

function sameAuthorityBinding(
  left: SalesImportBatchAuthorityBinding,
  right: SalesImportBatchAuthorityBinding,
) {
  return (
    left.subjectId === right.subjectId &&
    left.authorityRole === right.authorityRole &&
    left.authorityEvidenceDigest === right.authorityEvidenceDigest &&
    left.verifierId === right.verifierId
  );
}

function transitionVectorEntry(
  entry: SalesImportApprovalTransitionPlanEntry,
  value: ApprovalEntity,
) {
  return {
    sequence: entry.sequence,
    target: entry.target,
    targetId: entry.targetId,
    approvalStatus: value.approvalStatus,
    approvalDecisionRef: value.approvalDecisionRef,
    approvalManifestFingerprint: value.approvalFingerprint,
    approvalManifestContractVersion: value.approvalFingerprintVersion,
    reviewedBy: value.reviewedBy,
    approvalAuthorityRole: value.approvalAuthorityRole,
    approvalAuthorityEvidenceDigest: value.approvalAuthorityEvidenceDigest,
    approvalVerifierId: value.approvalVerifierId,
    reviewedAtPresent: value.reviewedAt !== null,
    reviewReasonPresent:
      typeof value.reviewReason === "string" && value.reviewReason.trim().length > 0,
  };
}

function expectedTransitionVectorEntry({
  entry,
  approved,
  decisionRef,
  manifestFingerprint,
  authorityBinding,
}: {
  entry: SalesImportApprovalTransitionPlanEntry;
  approved: boolean;
  decisionRef: string;
  manifestFingerprint: string;
  authorityBinding: SalesImportBatchAuthorityBinding | null;
}) {
  return {
    sequence: entry.sequence,
    target: entry.target,
    targetId: entry.targetId,
    approvalStatus: approved ? "APPROVED" : "PENDING",
    approvalDecisionRef: approved ? decisionRef : null,
    approvalManifestFingerprint: approved ? manifestFingerprint : null,
    approvalManifestContractVersion: approved
      ? salesImportApprovalManifestContractVersion
      : null,
    reviewedBy: approved ? authorityBinding?.subjectId ?? null : null,
    approvalAuthorityRole: approved ? "CEO" : null,
    approvalAuthorityEvidenceDigest: approved
      ? authorityBinding?.authorityEvidenceDigest ?? null
      : null,
    approvalVerifierId: approved ? authorityBinding?.verifierId ?? null : null,
    reviewedAtPresent: approved,
    reviewReasonPresent: approved,
  };
}

function assertInitialApprovalState(
  graph: ApprovalGraph,
  transitionPlan: SalesImportApprovalTransitionPlanEntry[],
) {
  const valid = transitionPlan.every((entry) => {
    const value = approvalEntityForTransition(graph, entry);
    return (
      value !== null &&
      value.approvalStatus === ImportApprovalStatus.PENDING &&
      approvalAuditFieldsUnset(value)
    );
  });
  if (!valid) throw new Error("INITIAL_APPROVAL_STATE_MISMATCH");
}

function createSalesImportApprovalTransitionState({
  graph,
  approvalManifestFingerprint,
  approvalDecisionRef,
}: {
  graph: ApprovalGraph;
  approvalManifestFingerprint: string;
  approvalDecisionRef: string;
}): SalesImportApprovalTransitionState {
  assertSha256(approvalManifestFingerprint, "approvalManifestFingerprint");
  assertNonEmpty(approvalDecisionRef, "approvalDecisionRef");
  const manifest = createSalesImportApprovalManifest(graph);
  if (manifest.fingerprint !== approvalManifestFingerprint) {
    throw new Error("APPROVAL_MANIFEST_MISMATCH");
  }

  const values = manifest.transitionPlan.map((entry) => {
    const value = approvalEntityForTransition(graph, entry);
    if (!value) throw new Error("APPROVAL_MANIFEST_MEMBERSHIP_MISMATCH");
    return value;
  });
  const validApprovedEvidence = values.filter(
    (value) =>
      value.approvalStatus === ImportApprovalStatus.APPROVED &&
      completeApprovedAuditBinding(value),
  );
  if (validApprovedEvidence.length === 0) {
    assertInitialApprovalState(graph, manifest.transitionPlan);
  }

  // A valid batch is one approved prefix followed by untouched pending entries.
  let completedTransitionCount = 0;
  while (
    completedTransitionCount < values.length &&
    values[completedTransitionCount].approvalStatus ===
      ImportApprovalStatus.APPROVED
  ) {
    completedTransitionCount += 1;
  }

  let authorityBinding: SalesImportBatchAuthorityBinding | null = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (index < completedTransitionCount) {
      if (
        !completeApprovedAuditBinding(value) ||
        value.approvalDecisionRef !== approvalDecisionRef ||
        value.approvalFingerprint !== approvalManifestFingerprint ||
        value.approvalFingerprintVersion !==
          salesImportApprovalManifestContractVersion
      ) {
        if (value.approvalDecisionRef !== approvalDecisionRef) {
          throw new Error("BATCH_APPROVAL_DECISION_MISMATCH");
        }
        throw new Error("APPROVAL_TRANSITION_STATE_MISMATCH");
      }
      const currentBinding = authorityBindingFrom(value);
      if (authorityBinding && !sameAuthorityBinding(authorityBinding, currentBinding)) {
        throw new Error("BATCH_APPROVAL_AUTHORITY_BINDING_MISMATCH");
      }
      authorityBinding ??= currentBinding;
      continue;
    }
    if (
      value.approvalStatus !== ImportApprovalStatus.PENDING ||
      !approvalAuditFieldsUnset(value)
    ) {
      throw new Error("APPROVAL_TRANSITION_STATE_MISMATCH");
    }
  }

  const actualStateVector = manifest.transitionPlan.map((entry, index) =>
    transitionVectorEntry(entry, values[index]),
  );
  const expectedStateVector = manifest.transitionPlan.map((entry, index) =>
    expectedTransitionVectorEntry({
      entry,
      approved: index < completedTransitionCount,
      decisionRef: approvalDecisionRef,
      manifestFingerprint: approvalManifestFingerprint,
      authorityBinding,
    }),
  );
  const actualStateVectorFingerprint = sha256(stableSerialize(actualStateVector));
  const expectedStateVectorFingerprint = sha256(
    stableSerialize(expectedStateVector),
  );
  if (actualStateVectorFingerprint !== expectedStateVectorFingerprint) {
    throw new Error("APPROVAL_TRANSITION_STATE_MISMATCH");
  }

  const nextTransition =
    manifest.transitionPlan[completedTransitionCount] ?? null;
  const canonicalInput: Record<string, unknown> = {
    transitionStateContractVersion:
      salesImportApprovalTransitionStateContractVersion,
    fingerprintAlgorithm: salesImportApprovalFingerprintAlgorithm,
    canonicalizationVersion:
      salesImportApprovalTransitionStateCanonicalizationVersion,
    approvalManifestContractVersion:
      salesImportApprovalManifestContractVersion,
    approvalManifestFingerprint,
    currentBusinessStateManifestFingerprint: manifest.fingerprint,
    importRunId: graph.id,
    approvalDecisionRef,
    authorityBinding,
    transitionPosition: {
      completedTransitionCount,
      totalTransitionCount: manifest.transitionPlan.length,
      nextTransition,
    },
    actualStateVector,
    actualStateVectorFingerprint,
    expectedStateVectorFingerprint,
  };
  return {
    fingerprint: sha256(stableSerialize(canonicalInput)),
    canonicalInput,
    completedTransitionCount,
    nextTransition,
    authorityBinding,
  };
}

export async function buildSalesImportApprovalTransitionState({
  prisma,
  importRunId,
  approvalManifestFingerprint,
  approvalDecisionRef,
}: {
  prisma: ApprovalStore;
  importRunId: string;
  approvalManifestFingerprint: string;
  approvalDecisionRef: string;
}): Promise<SalesImportApprovalTransitionState> {
  return createSalesImportApprovalTransitionState({
    graph: await loadApprovalGraph(prisma, importRunId),
    approvalManifestFingerprint,
    approvalDecisionRef,
  });
}

async function verifyAuthority({
  verifier,
  authorization,
  target,
  targetId,
  importRunId,
  manifestFingerprint,
  existingAuthorityBinding,
}: {
  verifier: SalesImportApprovalAuthorityVerifier;
  authorization: SalesImportApprovalAuthorization;
  target: SalesImportApprovalTarget;
  targetId: string;
  importRunId: string;
  manifestFingerprint: string;
  existingAuthorityBinding: SalesImportBatchAuthorityBinding | null;
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
    approvalManifestFingerprint: manifestFingerprint,
    manifestContractVersion: salesImportApprovalManifestContractVersion,
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
  const verifiedBinding: SalesImportBatchAuthorityBinding = {
    subjectId: verified.subjectId,
    authorityRole: verified.authorityRole,
    authorityEvidenceDigest: verified.authorityEvidenceDigest,
    verifierId: verified.verifierId,
  };
  if (
    existingAuthorityBinding &&
    !sameAuthorityBinding(existingAuthorityBinding, verifiedBinding)
  ) {
    throw new Error("BATCH_APPROVAL_AUTHORITY_BINDING_MISMATCH");
  }
  return verified;
}

function assertTransitionStateFingerprint(current: string, expected: string) {
  assertSha256(expected, "expectedTransitionStateFingerprint");
  if (current !== expected) {
    throw new Error("APPROVAL_TRANSITION_STATE_FINGERPRINT_MISMATCH");
  }
}

function approvalAuditData({
  manifestFingerprint,
  verified,
  reason,
  reviewedAt,
}: {
  manifestFingerprint: string;
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
    approvalFingerprint: manifestFingerprint,
    approvalFingerprintVersion: salesImportApprovalManifestContractVersion,
    approvalDecisionRef: verified.decisionRef,
    approvalAuthorityRole: verified.authorityRole,
    approvalAuthorityEvidenceDigest: verified.authorityEvidenceDigest,
    approvalVerifierId: verified.verifierId,
  };
}

async function resolveTransitionImportRunId(
  store: ApprovalStore,
  target: SalesImportApprovalTarget,
  targetId: string,
) {
  if (target === "RUN") {
    const run = await store.importRun.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!run) throw new Error("ImportRun not found");
    return run.id;
  }
  if (target === "SOURCE") {
    const source = await store.importSource.findUnique({
      where: { id: targetId },
      select: { importRunId: true },
    });
    if (!source) throw new Error("ImportSource not found");
    return source.importRunId;
  }
  const record = await store.canonicalSalesRecord.findUnique({
    where: { id: targetId },
    select: { importRunId: true },
  });
  if (!record) throw new Error("Canonical Sales Record not found");
  return record.importRunId;
}

function assertManifestReady(manifest: SalesImportApprovalManifest) {
  const importRun = manifest.canonicalInput.importRun as {
    readiness?: { lifecycleEligible?: unknown };
  };
  if (importRun.readiness?.lifecycleEligible !== true) {
    throw new Error("SALES_IMPORT_APPROVAL_MANIFEST_NOT_READY");
  }
}

function assertParentGate({
  graph,
  entry,
}: {
  graph: ApprovalGraph;
  entry: SalesImportApprovalTransitionPlanEntry;
}) {
  if (entry.target === "RECORD") {
    const record = graph.canonicalSalesRecords.find(
      ({ id }) => id === entry.targetId,
    );
    if (!record || !validationOk(record)) {
      throw new Error("Invalid Canonical Sale cannot be APPROVED");
    }
    return;
  }
  if (entry.target === "SOURCE") {
    const requiredRecordIds = entry.requiresApprovedRecordIds ?? [];
    const records = new Map(
      graph.canonicalSalesRecords.map((record) => [record.id, record]),
    );
    if (
      requiredRecordIds.length === 0 ||
      requiredRecordIds.some(
        (id) =>
          records.get(id)?.approvalStatus !== ImportApprovalStatus.APPROVED,
      )
    ) {
      throw new Error(
        "ImportSource approval requires every in-scope child Canonical Sales Record to be APPROVED",
      );
    }
    return;
  }
  const requiredSourceIds = entry.requiresApprovedSourceIds ?? [];
  const sources = new Map(graph.sources.map((source) => [source.id, source]));
  if (
    graph.status !== canonicalPersistentImportRunStatusContract.completed ||
    requiredSourceIds.length === 0 ||
    requiredSourceIds.some(
      (id) => sources.get(id)?.approvalStatus !== ImportApprovalStatus.APPROVED,
    )
  ) {
    throw new Error(
      "ImportRun approval requires canonical completed status and every in-scope ImportSource to be APPROVED",
    );
  }
}

async function writeApprovedTransition({
  transaction,
  entry,
  data,
}: {
  transaction: Prisma.TransactionClient;
  entry: SalesImportApprovalTransitionPlanEntry;
  data: ReturnType<typeof approvalAuditData>;
}) {
  if (entry.target === "RECORD") {
    return transaction.canonicalSalesRecord.updateMany({
      where: {
        id: entry.targetId,
        approvalStatus: ImportApprovalStatus.PENDING,
      },
      data,
    });
  }
  if (entry.target === "SOURCE") {
    return transaction.importSource.updateMany({
      where: {
        id: entry.targetId,
        approvalStatus: ImportApprovalStatus.PENDING,
      },
      data,
    });
  }
  return transaction.importRun.updateMany({
    where: {
      id: entry.targetId,
      approvalStatus: ImportApprovalStatus.PENDING,
    },
    data,
  });
}

export function createSalesImportApprovalLifecycle({
  prisma,
  authorityVerifier,
}: {
  prisma: PrismaClient;
  authorityVerifier: SalesImportApprovalAuthorityVerifier;
}) {
  function executeTransition({
    target,
    targetId,
    request,
  }: {
    target: SalesImportApprovalTarget;
    targetId: string;
    request: SalesImportApprovalRequest;
  }): Promise<SalesImportApprovalExecutionEvidence> {
    assertCurrentManifestContractVersion(
      request.approvalManifestContractVersion,
    );
    return prisma.$transaction(async (transaction) => {
      const importRunId = await resolveTransitionImportRunId(
        transaction,
        target,
        targetId,
      );
      const graph = await loadApprovalGraph(transaction, importRunId);
      const manifest = createSalesImportApprovalManifest(graph);
      if (manifest.fingerprint !== request.approvalManifestFingerprint) {
        throw new Error("APPROVAL_MANIFEST_MISMATCH");
      }
      assertManifestReady(manifest);
      const beforeState = createSalesImportApprovalTransitionState({
        graph,
        approvalManifestFingerprint: request.approvalManifestFingerprint,
        approvalDecisionRef: request.authorization.decisionRef,
      });
      assertTransitionStateFingerprint(
        beforeState.fingerprint,
        request.expectedTransitionStateFingerprint,
      );

      const entry = manifest.transitionPlan.find(
        (candidate) =>
          candidate.target === target && candidate.targetId === targetId,
      );
      if (!entry) throw new Error("APPROVAL_MANIFEST_MEMBERSHIP_MISMATCH");
      const transitionIndex = entry.sequence - 1;
      if (transitionIndex > beforeState.completedTransitionCount) {
        throw new Error("UNEXPECTED_APPROVAL_TRANSITION_TARGET");
      }

      const verified = await verifyAuthority({
        verifier: authorityVerifier,
        authorization: request.authorization,
        target,
        targetId,
        importRunId,
        manifestFingerprint: manifest.fingerprint,
        existingAuthorityBinding: beforeState.authorityBinding,
      });

      if (transitionIndex < beforeState.completedTransitionCount) {
        return {
          approvalDecisionRef: verified.decisionRef,
          manifestFingerprint: manifest.fingerprint,
          target,
          targetId,
          transitionSequence: entry.sequence,
          beforeTransitionStateFingerprint: beforeState.fingerprint,
          afterTransitionStateFingerprint: beforeState.fingerprint,
          result: "ALREADY_APPROVED",
        };
      }
      if (
        !beforeState.nextTransition ||
        beforeState.nextTransition.sequence !== entry.sequence
      ) {
        throw new Error("UNEXPECTED_APPROVAL_TRANSITION_TARGET");
      }

      assertParentGate({ graph, entry });
      const write = await writeApprovedTransition({
        transaction,
        entry,
        data: approvalAuditData({
          manifestFingerprint: manifest.fingerprint,
          verified,
          reason: request.reason,
          reviewedAt: request.reviewedAt ?? new Date(),
        }),
      });
      if (write.count !== 1) {
        throw new Error("APPROVAL_TRANSITION_CONCURRENCY_MISMATCH");
      }

      const afterGraph = await loadApprovalGraph(transaction, importRunId);
      const afterManifest = createSalesImportApprovalManifest(afterGraph);
      if (afterManifest.fingerprint !== manifest.fingerprint) {
        throw new Error("APPROVAL_MANIFEST_CHANGED_DURING_TRANSITION");
      }
      const afterState = createSalesImportApprovalTransitionState({
        graph: afterGraph,
        approvalManifestFingerprint: manifest.fingerprint,
        approvalDecisionRef: verified.decisionRef,
      });
      if (
        afterState.completedTransitionCount !==
        beforeState.completedTransitionCount + 1
      ) {
        throw new Error("APPROVAL_TRANSITION_SEQUENCE_MISMATCH");
      }
      return {
        approvalDecisionRef: verified.decisionRef,
        manifestFingerprint: manifest.fingerprint,
        target,
        targetId,
        transitionSequence: entry.sequence,
        beforeTransitionStateFingerprint: beforeState.fingerprint,
        afterTransitionStateFingerprint: afterState.fingerprint,
        result: "APPROVED",
      };
    });
  }

  return {
    approveRecord({ recordId, ...request }: SalesImportApprovalRequest & {
      recordId: string;
    }) {
      return executeTransition({
        target: "RECORD",
        targetId: recordId,
        request,
      });
    },

    approveSource({ importSourceId, ...request }: SalesImportApprovalRequest & {
      importSourceId: string;
    }) {
      return executeTransition({
        target: "SOURCE",
        targetId: importSourceId,
        request,
      });
    },

    approveRun({ importRunId, ...request }: SalesImportApprovalRequest & {
      importRunId: string;
    }) {
      return executeTransition({
        target: "RUN",
        targetId: importRunId,
        request,
      });
    },
  };
}
