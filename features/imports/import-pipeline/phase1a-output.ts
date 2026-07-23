import {
  buildSourceMetadata,
  importOutputSchemaVersion,
  type ImportOutput,
  snapshotToImportOutputSnapshot,
} from "./output-schema.ts";
import { normalizeSnapshot } from "./image.ts";
import type {
  SnapshotExtraction,
  SourceClassification,
  SourceInspection,
  ValidationResult,
} from "./types.ts";

export function buildPhase1AImportOutput({
  inspection,
  classification,
  extraction,
  validation,
  importedAt,
  importedBy,
  pipelineVersion,
}: {
  inspection: SourceInspection;
  classification: SourceClassification;
  extraction: SnapshotExtraction | null;
  validation: ValidationResult;
  importedAt: string;
  importedBy: string;
  pipelineVersion: string;
}): ImportOutput {
  const normalizedSnapshot = extraction
    ? normalizeSnapshot({ classification, extraction, inspection })
    : null;
  const validationStatus = validation.ok ? "passed" : "failed";
  const snapshotStatus =
    validation.ok && normalizedSnapshot && !classification.reviewRequired
      ? "approved"
      : validation.ok && normalizedSnapshot
        ? "review_required"
        : "rejected";
  const snapshots =
    normalizedSnapshot && validation.ok
      ? [
          snapshotToImportOutputSnapshot({
            snapshot: normalizedSnapshot,
            status: snapshotStatus,
            validationStatus,
          }),
        ]
      : [];

  return {
    schemaVersion: importOutputSchemaVersion,
    importRun: {
      status: validation.ok ? "review_required" : "failed",
      startedAt: importedAt,
      completedAt: importedAt,
      importedAt,
      importedBy,
      pipelineVersion,
      summary: {
        sourceKind: classification.sourceKind,
        snapshotType: classification.snapshotType,
        snapshotCount: snapshots.length,
      },
      error: validation.ok ? null : validation.issues.join(", "),
    },
    importSource: buildSourceMetadata({
      inspection,
      sourceType: classification.sourceKind,
      parserVersion: pipelineVersion,
      confidence: classification.confidence,
      importedAt,
      importedBy,
    }),
    classification,
    extraction: extraction
      ? {
          activeTab: extraction.activeTab,
          periodLabel: extraction.periodLabel,
          periodStart: extraction.periodStart,
          periodEnd: extraction.periodEnd,
          pv: extraction.pv,
          comments: extraction.comments,
          likes: extraction.likes,
        }
      : null,
    normalizedRecords: [],
    validation,
    snapshots,
    evidence: {
      classification: classification.evidence,
      extraction: extraction?.evidence ?? [],
    },
    errors: validation.ok ? [] : validation.issues,
    warnings: classification.rejectionReason ? [classification.rejectionReason] : [],
  };
}
