export const parserVersion = "note-import-pipeline-phase1-v1";

export const snapshotTypes = ["ALL_TIME", "YEARLY", "MONTHLY", "WEEKLY"] as const;

export type SnapshotType = (typeof snapshotTypes)[number];

export type SourceKind =
  | "note_access_dashboard"
  | "note_article_list"
  | "note_sales_history_csv"
  | "unsupported";

export type SourceInspection = {
  sourceHash: string;
  fileName: string;
  fileSizeBytes: number;
  mime: string | null;
  fileSignature: string;
  image?: {
    width: number;
    height: number;
  };
  csv?: {
    encoding: "utf-8" | "unknown";
    hasUtf8Bom: boolean;
    headers: string[];
    rowCount: number;
    rowWidths: number[];
    schemaCompatible: boolean;
  };
};

export type ClassificationEvidence = {
  matchedKeywords: string[];
  rejectedKeywords: string[];
  layoutSignals: string[];
};

export type SourceClassification = {
  sourceKind: SourceKind;
  snapshotType: SnapshotType | null;
  confidence: number;
  evidence: ClassificationEvidence;
  reviewRequired: boolean;
  rejectionReason: string | null;
};

export type SnapshotExtraction = {
  activeTab: "全期間" | "年" | "月" | "週" | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  pv: number | null;
  comments: number | null;
  likes: number | null;
  evidence: string[];
};

export type NormalizedSnapshot = SnapshotExtraction & {
  snapshotType: SnapshotType;
  confidence: number;
  sourceHash: string;
  parserVersion: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: string[];
};

export type PersistDecision = {
  canPersistSnapshot: boolean;
  canUpdateArticlePv: boolean;
  status: "ready" | "review_required" | "rejected";
  reasons: string[];
};
