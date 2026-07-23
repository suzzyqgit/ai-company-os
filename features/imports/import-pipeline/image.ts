import { createHash } from "node:crypto";
import type {
  NormalizedSnapshot,
  PersistDecision,
  SnapshotExtraction,
  SnapshotType,
  SourceClassification,
  SourceInspection,
  ValidationResult,
} from "./types.ts";
import { parserVersion } from "./types.ts";

const tabToSnapshotType = {
  全期間: "ALL_TIME",
  年: "YEARLY",
  月: "MONTHLY",
  週: "WEEKLY",
} as const satisfies Record<string, SnapshotType>;

function getImageMime(buffer: Buffer, fallback: string | null) {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return fallback;
}

export async function inspectImageSource({
  buffer,
  fileName,
  mime = null,
}: {
  buffer: Buffer;
  fileName: string;
  mime?: string | null;
}): Promise<SourceInspection> {
  const { default: sharp } = await import("sharp");
  const metadata = await sharp(buffer).metadata();

  return {
    sourceHash: createHash("sha256").update(buffer).digest("hex"),
    fileName,
    fileSizeBytes: buffer.length,
    mime: getImageMime(buffer, mime),
    fileSignature: buffer.subarray(0, 16).toString("hex").toUpperCase(),
    image: {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
    },
  };
}

function normalizeOcrText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .trim();
}

function parseNumber(value: string) {
  const normalized = value.replace(/[,，\s]/g, "");
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}

function findActiveTab(text: string): SnapshotExtraction["activeTab"] {
  const normalized = normalizeOcrText(text);
  const explicitTab = normalized.match(
    /(?:選択中|active(?:\s+tab)?)\s*[:：]?\s*(全期間|年|月|週)/i,
  )?.[1] as SnapshotExtraction["activeTab"] | undefined;

  if (explicitTab) {
    return explicitTab;
  }

  const { periodStart, periodEnd } = extractPeriod(normalized);

  if (periodStart && periodEnd) {
    const start = Date.parse(`${periodStart}T00:00:00.000Z`);
    const end = Date.parse(`${periodEnd}T00:00:00.000Z`);
    const days = Math.round((end - start) / 86_400_000) + 1;

    if (days >= 300) {
      return "年";
    }

    if (days >= 20) {
      return "月";
    }

    if (days >= 1) {
      return "週";
    }
  }

  if (/全期間/.test(normalized)) {
    return "全期間";
  }

  if (/(^|\s)年(\s|$)/.test(normalized) || /年間|過去1年/.test(normalized)) {
    return "年";
  }

  if (/(^|\s)月(\s|$)/.test(normalized) || /月間|過去30日/.test(normalized)) {
    return "月";
  }

  if (/(^|\s)週(\s|$)/.test(normalized) || /週間|過去7日/.test(normalized)) {
    return "週";
  }

  return null;
}

function inclusivePeriodDays(periodStart: string, periodEnd: string) {
  const start = Date.parse(`${periodStart}T00:00:00.000Z`);
  const end = Date.parse(`${periodEnd}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return Math.round((end - start) / 86_400_000) + 1;
}

function periodMatchesSnapshotType(
  snapshotType: Exclude<SnapshotType, "ALL_TIME">,
  days: number,
) {
  switch (snapshotType) {
    case "YEARLY":
      return days >= 300 && days <= 370;
    case "MONTHLY":
      return days >= 20 && days <= 35;
    case "WEEKLY":
      return days >= 1 && days <= 8;
  }
}

function toIsoDate(year: string, month: string, day: string) {
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractPeriod(text: string) {
  const normalized = normalizeOcrText(text);
  const match = normalized.match(
    /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日\s*[-ー−~～]\s*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/,
  );

  if (!match) {
    return {
      periodLabel: null,
      periodStart: null,
      periodEnd: null,
    };
  }

  return {
    periodLabel: match[0],
    periodStart: toIsoDate(match[1], match[2], match[3]),
    periodEnd: toIsoDate(match[4], match[5], match[6]),
  };
}

function valuesBeforeMetricLabels(text: string) {
  const normalized = normalizeOcrText(text);
  const { periodLabel } = extractPeriod(normalized);
  const beforeLabels = (normalized.split(/全体ビュー|ビュー/)[0] ?? normalized)
    .replace(periodLabel ?? "", "")
    .replace(/アクセス状況|ダッシュボード|note|週|月|年|全期間|コメント|スキ/g, " ");
  return Array.from(beforeLabels.matchAll(/\d[\d,，]*/g))
    .map((match) => parseNumber(match[0]))
    .filter((value): value is number => value !== null);
}

export function classifyImageOcr({
  ocrText,
}: {
  ocrText: string;
}): SourceClassification {
  const text = normalizeOcrText(ocrText);
  const matchedKeywords: string[] = [];
  const rejectedKeywords: string[] = [];
  const layoutSignals: string[] = [];
  const articleListSignals = ["タイトル", "価格", "購入数", "購入率", "更新日"].filter((keyword) =>
    text.includes(keyword),
  );
  const accessSignals = ["アクセス状況", "全体ビュー", "コメント", "スキ"].filter((keyword) =>
    text.includes(keyword),
  );

  if (articleListSignals.length >= 3) {
    matchedKeywords.push(...articleListSignals);
    rejectedKeywords.push("not_access_dashboard_layout");
    layoutSignals.push("article_list_table");
    return {
      sourceKind: "note_article_list",
      snapshotType: null,
      confidence: 0.94,
      evidence: { matchedKeywords, rejectedKeywords, layoutSignals },
      reviewRequired: true,
      rejectionReason: "Article-list screenshots are classification-only in Phase 1.",
    };
  }

  if (accessSignals.length >= 3) {
    matchedKeywords.push(...accessSignals);
    layoutSignals.push("access_dashboard_summary");
    const activeTab = findActiveTab(text);
    const snapshotType = activeTab ? tabToSnapshotType[activeTab] : null;
    return {
      sourceKind: "note_access_dashboard",
      snapshotType,
      confidence: snapshotType ? 0.96 : 0.72,
      evidence: { matchedKeywords, rejectedKeywords, layoutSignals },
      reviewRequired: snapshotType !== "ALL_TIME",
      rejectionReason: snapshotType ? null : "Snapshot type could not be determined.",
    };
  }

  return {
    sourceKind: "unsupported",
    snapshotType: null,
    confidence: 0,
    evidence: { matchedKeywords, rejectedKeywords: ["no_supported_layout"], layoutSignals },
    reviewRequired: true,
    rejectionReason: "Source layout is unsupported.",
  };
}

export function extractSnapshotFromOcr(ocrText: string): SnapshotExtraction {
  const text = normalizeOcrText(ocrText);
  const activeTab = findActiveTab(text);
  const { periodLabel, periodStart, periodEnd } = extractPeriod(text);
  const values = valuesBeforeMetricLabels(text).slice(-3);

  return {
    activeTab,
    periodLabel,
    periodStart,
    periodEnd,
    pv: values[0] ?? null,
    comments: values[1] ?? null,
    likes: values[2] ?? null,
    evidence: [
      activeTab ? `active_tab:${activeTab}` : "active_tab:unresolved",
      periodLabel ? `period:${periodLabel}` : "period:unresolved",
    ],
  };
}

export function normalizeSnapshot({
  classification,
  extraction,
  inspection,
}: {
  classification: SourceClassification;
  extraction: SnapshotExtraction;
  inspection: SourceInspection;
}): NormalizedSnapshot | null {
  if (
    classification.sourceKind !== "note_access_dashboard" ||
    !classification.snapshotType ||
    classification.snapshotType === "ALL_TIME"
  ) {
    return null;
  }

  return {
    ...extraction,
    snapshotType: classification.snapshotType,
    confidence: classification.confidence,
    sourceHash: inspection.sourceHash,
    parserVersion,
  };
}

export function validateSnapshot(snapshot: NormalizedSnapshot | null): ValidationResult {
  const issues: string[] = [];

  if (!snapshot) {
    return {
      ok: false,
      issues: ["normalized_snapshot_missing"],
    };
  }

  if (!snapshot.sourceHash) {
    issues.push("source_hash_missing");
  } else if (!/^[a-f0-9]{64}$/i.test(snapshot.sourceHash)) {
    issues.push("source_hash_invalid");
  }

  if (snapshot.confidence < 0 || snapshot.confidence > 1) {
    issues.push("confidence_out_of_range");
  }

  if (!snapshot.periodStart || !snapshot.periodEnd) {
    issues.push("period_unresolved");
  } else if (snapshot.periodStart > snapshot.periodEnd) {
    issues.push("period_start_after_end");
  } else {
    const days = inclusivePeriodDays(snapshot.periodStart, snapshot.periodEnd);

    if (
      days === null ||
      (snapshot.snapshotType !== "ALL_TIME" &&
        !periodMatchesSnapshotType(snapshot.snapshotType, days))
    ) {
      issues.push("snapshot_type_period_range_mismatch");
    }
  }

  if (snapshot.snapshotType === "ALL_TIME") {
    issues.push("period_snapshot_must_not_be_all_time");
  }

  const expectedTab =
    snapshot.snapshotType === "ALL_TIME"
      ? null
      : {
    YEARLY: "年",
    MONTHLY: "月",
    WEEKLY: "週",
        }[snapshot.snapshotType];

  if (expectedTab && snapshot.activeTab !== expectedTab) {
    issues.push("snapshot_type_period_tab_mismatch");
  }

  if (
    snapshot.evidence.length === 0 ||
    !snapshot.evidence.some((item) => item.startsWith("active_tab:")) ||
    !snapshot.evidence.some((item) => item.startsWith("period:"))
  ) {
    issues.push("required_evidence_missing");
  }

  for (const [field, value] of [
    ["pv", snapshot.pv],
    ["comments", snapshot.comments],
    ["likes", snapshot.likes],
  ] as const) {
    if (value === null) {
      issues.push(`${field}_unresolved`);
    } else if (value < 0) {
      issues.push(`${field}_negative`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function decideSnapshotPersist({
  classification,
  validation,
}: {
  classification: SourceClassification;
  validation: ValidationResult;
}): PersistDecision {
  const reasons = [...validation.issues];

  if (classification.sourceKind !== "note_access_dashboard") {
    reasons.push("classification_not_persistable");
  }

  if (!classification.snapshotType) {
    reasons.push("snapshot_type_missing");
  }

  if (!validation.ok || classification.reviewRequired) {
    return {
      canPersistSnapshot: validation.ok && classification.sourceKind === "note_access_dashboard",
      canUpdateArticlePv: false,
      status: validation.ok ? "review_required" : "rejected",
      reasons,
    };
  }

  return {
    canPersistSnapshot: true,
    canUpdateArticlePv: classification.snapshotType === "ALL_TIME",
    status: "ready",
    reasons,
  };
}
