import type {
  NormalizedSnapshot,
  SourceClassification,
  SourceInspection,
  ValidationResult,
} from "./types.ts";

export const importOutputSchemaVersion = "1.0";
export const sourceMetadataStandardVersion = "1.0";
export const snapshotFeedContractVersion = "1.0";
export const pipelinePersistenceContractVersion = "1.0";

export const importRunStatuses = [
  "started",
  "completed",
  "failed",
  "review_required",
] as const;

export const snapshotStatuses = [
  "approved",
  "review_required",
  "rejected",
] as const;

export const validationStatuses = [
  "passed",
  "failed",
  "passed_with_warnings",
] as const;

export type ImportRunStatus = (typeof importRunStatuses)[number];
export type SnapshotStatus = (typeof snapshotStatuses)[number];
export type SnapshotValidationStatus = (typeof validationStatuses)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = { [key: string]: JsonValue };

export type SourceMetadata = {
  schemaVersion: typeof sourceMetadataStandardVersion;
  sourceType: string;
  sourceFile: string;
  sourceHash: string;
  importedAt: string;
  importedBy: string;
  parserVersion: string;
  confidence: number | null;
  inspection: {
    mime: string | null;
    fileSignature: string;
    fileSizeBytes: number;
    image?: {
      width: number;
      height: number;
    };
    csv?: {
      encoding: string;
      hasUtf8Bom: boolean;
      headerCount: number;
      rowCount: number;
      rowWidths: number[];
      schemaCompatible: boolean;
    };
  };
};

export type ImportOutputSnapshot = {
  domain: string;
  snapshotType: string;
  periodStart: string | null;
  periodEnd: string | null;
  observedAt: string | null;
  confidence: number | null;
  status: SnapshotStatus;
  validationStatus: SnapshotValidationStatus;
  data: JsonRecord;
  evidence: JsonRecord;
  articleId?: string | null;
  pv?: number | null;
  likes?: number | null;
  comments?: number | null;
};

export type ImportOutput = {
  schemaVersion: typeof importOutputSchemaVersion;
  importRun: {
    status: ImportRunStatus;
    startedAt: string;
    completedAt: string | null;
    importedAt: string;
    importedBy: string;
    pipelineVersion: string;
    summary: JsonRecord | null;
    error: string | null;
  };
  importSource: SourceMetadata;
  classification: SourceClassification;
  extraction: JsonRecord | null;
  normalizedRecords: JsonRecord[];
  validation: ValidationResult;
  snapshots: ImportOutputSnapshot[];
  evidence: JsonRecord;
  errors: string[];
  warnings: string[];
};

export type ValidatorResult = {
  ok: boolean;
  issues: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown) {
  return typeof value === "string";
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidIsoDateTime(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function isSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

function isStatus<T extends readonly string[]>(value: unknown, statuses: T): value is T[number] {
  return typeof value === "string" && statuses.includes(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function validateJsonRecord(value: unknown, label: string, issues: string[]) {
  if (!isRecord(value) || !isJsonValue(value)) {
    issues.push(`${label}_must_be_json_record`);
  }
}

export function validateSourceMetadata(value: unknown): ValidatorResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      issues: ["source_metadata_must_be_object"],
    };
  }

  if (value.schemaVersion !== sourceMetadataStandardVersion) {
    issues.push("source_metadata_schema_version_invalid");
  }

  for (const key of ["sourceType", "sourceFile", "sourceHash", "importedAt", "importedBy", "parserVersion"]) {
    if (!isString(value[key])) {
      issues.push(`${key}_must_be_string`);
    }
  }

  if (isString(value.sourceHash) && !isSha256(value.sourceHash)) {
    issues.push("source_hash_must_be_sha256");
  }

  if (isString(value.importedAt) && !isValidIsoDateTime(value.importedAt)) {
    issues.push("imported_at_must_be_iso_datetime");
  }

  if (!isNullableNumber(value.confidence)) {
    issues.push("confidence_must_be_number_or_null");
  } else if (typeof value.confidence === "number" && (value.confidence < 0 || value.confidence > 1)) {
    issues.push("confidence_out_of_range");
  }

  if (!isRecord(value.inspection)) {
    issues.push("inspection_must_be_object");
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateImportOutput(value: unknown): ValidatorResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      issues: ["import_output_must_be_object"],
    };
  }

  if (value.schemaVersion !== importOutputSchemaVersion) {
    issues.push("schema_version_invalid");
  }

  if (!isRecord(value.importRun)) {
    issues.push("import_run_missing");
  } else {
    if (!isStatus(value.importRun.status, importRunStatuses)) {
      issues.push("import_run_status_invalid");
    }

    for (const key of ["startedAt", "importedAt", "importedBy", "pipelineVersion"]) {
      if (!isString(value.importRun[key])) {
        issues.push(`import_run_${key}_must_be_string`);
      }
    }

    if (!isNullableString(value.importRun.completedAt)) {
      issues.push("import_run_completedAt_invalid");
    }

    if (!isNullableString(value.importRun.error)) {
      issues.push("import_run_error_invalid");
    }

    if (value.importRun.summary !== null) {
      validateJsonRecord(value.importRun.summary, "import_run_summary", issues);
    }
  }

  const metadataResult = validateSourceMetadata(value.importSource);
  issues.push(...metadataResult.issues.map((issue) => `import_source_${issue}`));

  if (!isRecord(value.classification)) {
    issues.push("classification_missing");
  }

  if (value.extraction !== null) {
    validateJsonRecord(value.extraction, "extraction", issues);
  }

  if (!Array.isArray(value.normalizedRecords)) {
    issues.push("normalized_records_must_be_array");
  } else {
    value.normalizedRecords.forEach((record, index) =>
      validateJsonRecord(record, `normalized_records_${index}`, issues),
    );
  }

  if (!isRecord(value.validation) || typeof value.validation.ok !== "boolean" || !Array.isArray(value.validation.issues)) {
    issues.push("validation_invalid");
  }

  if (!Array.isArray(value.snapshots)) {
    issues.push("snapshots_must_be_array");
  } else {
    value.snapshots.forEach((snapshot, index) => {
      if (!isRecord(snapshot)) {
        issues.push(`snapshot_${index}_must_be_object`);
        return;
      }

      for (const key of ["domain", "snapshotType", "status", "validationStatus"]) {
        if (!isString(snapshot[key])) {
          issues.push(`snapshot_${index}_${key}_must_be_string`);
        }
      }

      if (isString(snapshot.status) && !isStatus(snapshot.status, snapshotStatuses)) {
        issues.push(`snapshot_${index}_status_invalid`);
      }

      if (isString(snapshot.validationStatus) && !isStatus(snapshot.validationStatus, validationStatuses)) {
        issues.push(`snapshot_${index}_validation_status_invalid`);
      }

      if (
        snapshot.status === "approved" &&
        (snapshot.validationStatus === "failed" ||
          (isRecord(value.validation) && value.validation.ok === false))
      ) {
        issues.push(`snapshot_${index}_failed_validation_must_not_be_approved`);
      }

      for (const key of ["periodStart", "periodEnd", "observedAt"]) {
        if (!isNullableString(snapshot[key])) {
          issues.push(`snapshot_${index}_${key}_must_be_string_or_null`);
        }
      }

      for (const key of ["confidence", "pv", "likes", "comments"]) {
        if (!isNullableNumber(snapshot[key])) {
          issues.push(`snapshot_${index}_${key}_must_be_number_or_null`);
        }
      }

      validateJsonRecord(snapshot.data, `snapshot_${index}_data`, issues);
      validateJsonRecord(snapshot.evidence, `snapshot_${index}_evidence`, issues);

      if (isRecord(snapshot.evidence) && Object.keys(snapshot.evidence).length === 0) {
        issues.push(`snapshot_${index}_evidence_required`);
      }
    });
  }

  validateJsonRecord(value.evidence, "evidence", issues);

  if (!Array.isArray(value.errors) || !value.errors.every(isString)) {
    issues.push("errors_must_be_string_array");
  }

  if (!Array.isArray(value.warnings) || !value.warnings.every(isString)) {
    issues.push("warnings_must_be_string_array");
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function buildSourceMetadata({
  inspection,
  sourceType,
  parserVersion,
  confidence,
  importedAt,
  importedBy,
}: {
  inspection: SourceInspection;
  sourceType: string;
  parserVersion: string;
  confidence: number | null;
  importedAt: string;
  importedBy: string;
}): SourceMetadata {
  return {
    schemaVersion: sourceMetadataStandardVersion,
    sourceType,
    sourceFile: inspection.fileName,
    sourceHash: inspection.sourceHash,
    importedAt,
    importedBy,
    parserVersion,
    confidence,
    inspection: {
      mime: inspection.mime,
      fileSignature: inspection.fileSignature,
      fileSizeBytes: inspection.fileSizeBytes,
      image: inspection.image,
      csv: inspection.csv
        ? {
            encoding: inspection.csv.encoding,
            hasUtf8Bom: inspection.csv.hasUtf8Bom,
            headerCount: inspection.csv.headers.length,
            rowCount: inspection.csv.rowCount,
            rowWidths: inspection.csv.rowWidths,
            schemaCompatible: inspection.csv.schemaCompatible,
          }
        : undefined,
    },
  };
}

export function snapshotToImportOutputSnapshot({
  snapshot,
  status,
  validationStatus,
}: {
  snapshot: NormalizedSnapshot;
  status: SnapshotStatus;
  validationStatus: SnapshotValidationStatus;
}): ImportOutputSnapshot {
  return {
    domain: "note",
    snapshotType: snapshot.snapshotType,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    observedAt: snapshot.periodEnd,
    confidence: snapshot.confidence,
    status,
    validationStatus,
    data: {
      pv: snapshot.pv,
      likes: snapshot.likes,
      comments: snapshot.comments,
    },
    evidence: {
      parserVersion: snapshot.parserVersion,
      sourceHash: snapshot.sourceHash,
      extractionEvidence: snapshot.evidence,
    },
    pv: snapshot.pv,
    likes: snapshot.likes,
    comments: snapshot.comments,
  };
}
