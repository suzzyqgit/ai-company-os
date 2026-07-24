import { createHash } from "node:crypto";
import { CsvSalesAdapterV1 } from "./csv-adapter-v1.ts";
import { buildSalesBusinessKey } from "./import-ledger.ts";
import { runSalesImportAdapter } from "./sales-import-adapter.ts";
import { validateCanonicalSale, type CanonicalSale } from "./canonical-sales.ts";

export const importModes = ["DRY_RUN", "COMMIT"] as const;
export type ImportMode = (typeof importModes)[number];

export type PromotionReadinessSource = {
  sourceName: string;
  buffer: Buffer;
};

export type DryRunRecord = {
  businessKey: string;
  originalProductName: string;
  normalizedProductName: string;
  candidateArticleId: null;
  candidateProductId: null;
  matchConfidence: null;
  approvalStatus: "APPROVED" | "REVIEW_REQUIRED";
  sale: CanonicalSale;
};

export type PromotionReadinessReport = {
  mode: "DRY_RUN";
  inputFingerprint: string;
  runStatus: "COMPLETED" | "REVIEW_REQUIRED";
  runApprovalStatus: "APPROVED" | "REVIEW_REQUIRED";
  sourceCount: number;
  approvedSourceCount: number;
  recordCount: number;
  approvedRecordCount: number;
  reviewRequiredRecordCount: number;
  duplicateCount: number;
  issueCount: number;
  sensitiveValuesRetained: false;
  persistentWrites: 0;
  sources: Array<{
    sourceName: string;
    sourceHash: string;
    approvalStatus: "APPROVED" | "REVIEW_REQUIRED";
    recordCount: number;
    issueCount: number;
  }>;
  records: DryRunRecord[];
};

export function normalizeProductName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function runPromotionReadinessDryRun({
  mode = "DRY_RUN",
  sources,
}: {
  mode?: ImportMode;
  sources: PromotionReadinessSource[];
}): PromotionReadinessReport {
  if (mode !== "DRY_RUN") {
    throw new Error("COMMIT mode is reserved for Phase 2 Data Layer Promotion");
  }

  const records: DryRunRecord[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  let issueCount = 0;
  const sourceReports = sources.map(({ sourceName, buffer }) => {
    const sourceHash = createHash("sha256").update(buffer).digest("hex");
    const result = runSalesImportAdapter(
      [new CsvSalesAdapterV1()],
      { buffer, sourceHash },
    );
    issueCount += result.issues.length;

    for (const sale of result.records) {
      const businessKey = buildSalesBusinessKey(sale);
      const duplicateKey = `${businessKey}:${sourceHash}`;
      if (seen.has(duplicateKey)) duplicateCount += 1;
      seen.add(duplicateKey);
      const approvalStatus = validateCanonicalSale(sale).ok
        ? "APPROVED" as const
        : "REVIEW_REQUIRED" as const;
      records.push({
        businessKey,
        originalProductName: sale.productName,
        normalizedProductName: normalizeProductName(sale.productName),
        candidateArticleId: null,
        candidateProductId: null,
        matchConfidence: null,
        approvalStatus,
        sale,
      });
    }

    return {
      sourceName,
      sourceHash,
      approvalStatus:
        result.issues.length === 0 ? "APPROVED" as const : "REVIEW_REQUIRED" as const,
      recordCount: result.records.length,
      issueCount: result.issues.length,
    };
  });

  const reviewRequiredRecordCount = records.filter(
    (record) => record.approvalStatus === "REVIEW_REQUIRED",
  ).length;
  const approvedSourceCount = sourceReports.filter(
    (source) => source.approvalStatus === "APPROVED",
  ).length;
  const approved =
    issueCount === 0 &&
    duplicateCount === 0 &&
    reviewRequiredRecordCount === 0 &&
    approvedSourceCount === sources.length;
  const inputFingerprint = createHash("sha256")
    .update(JSON.stringify(sourceReports.map(({ sourceName, sourceHash }) => ({
      sourceName,
      sourceHash,
    }))))
    .digest("hex");

  return {
    mode: "DRY_RUN",
    inputFingerprint,
    runStatus: approved ? "COMPLETED" : "REVIEW_REQUIRED",
    runApprovalStatus: approved ? "APPROVED" : "REVIEW_REQUIRED",
    sourceCount: sources.length,
    approvedSourceCount,
    recordCount: records.length,
    approvedRecordCount: records.length - reviewRequiredRecordCount,
    reviewRequiredRecordCount,
    duplicateCount,
    issueCount,
    sensitiveValuesRetained: false,
    persistentWrites: 0,
    sources: sourceReports,
    records,
  };
}
