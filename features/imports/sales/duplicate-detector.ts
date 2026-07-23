import { createHash } from "node:crypto";
import type { CanonicalSale } from "./canonical-sales.ts";

export type SalesRecordReference = {
  sourceHash: string;
  rowNumber: number;
  sale: CanonicalSale;
};

export type SalesDuplicateCandidate = {
  fingerprint: string;
  records: Array<{
    sourceHash: string;
    rowNumber: number;
  }>;
};

function fingerprintSale(sale: CanonicalSale) {
  const comparable = [
    sale.saleDate,
    sale.productName.normalize("NFKC").trim(),
    sale.quantity,
    sale.grossAmount,
    sale.netAmount,
    sale.currency,
    sale.platform,
  ];

  return createHash("sha256").update(JSON.stringify(comparable)).digest("hex");
}

export function detectCrossSourceSalesDuplicates(
  records: SalesRecordReference[],
): SalesDuplicateCandidate[] {
  const groups = new Map<string, SalesRecordReference[]>();

  records.forEach((record) => {
    const fingerprint = fingerprintSale(record.sale);
    groups.set(fingerprint, [...(groups.get(fingerprint) ?? []), record]);
  });

  return [...groups.entries()]
    .filter(([, candidates]) => new Set(candidates.map((item) => item.sourceHash)).size > 1)
    .map(([fingerprint, candidates]) => ({
      fingerprint,
      records: candidates.map(({ sourceHash, rowNumber }) => ({ sourceHash, rowNumber })),
    }));
}
