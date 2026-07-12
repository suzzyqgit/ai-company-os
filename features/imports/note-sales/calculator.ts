import {
  type NoteSalesArticlePreview,
  type ParsedNoteSaleRow,
} from "./types";

export function getSignedPurchases(type: string) {
  return type === "返金" ? -1 : 1;
}

export function getSignedRevenue(type: string, amount: number) {
  return type === "返金" ? -amount : amount;
}

export function summarizeRowsByArticle({
  rows,
  existingArticleByTitle,
  duplicateTransactionIds,
}: {
  rows: ParsedNoteSaleRow[];
  existingArticleByTitle: Map<string, { id: string; price: number }>;
  duplicateTransactionIds: Set<string>;
}) {
  const summaries = new Map<
    string,
    NoteSalesArticlePreview & {
      latestSaleAt: string;
    }
  >();

  rows.forEach((row) => {
    if (duplicateTransactionIds.has(row.transactionId)) {
      return;
    }

    const existing = existingArticleByTitle.get(row.title) ?? null;
    const current = summaries.get(row.title) ?? {
      title: row.title,
      contentType: row.contentType,
      status: existing ? "existing" : "new",
      articleId: existing?.id ?? null,
      salesCount: 0,
      refundCount: 0,
      netPurchases: 0,
      grossSales: 0,
      grossRefunds: 0,
      netRevenue: 0,
      latestSaleAmount: 0,
      latestSaleAt: "",
      shouldUpdatePrice: false,
    };

    if (row.type === "販売") {
      current.salesCount += 1;
      current.grossSales += row.amount;

      if (row.occurredAt > current.latestSaleAt) {
        current.latestSaleAt = row.occurredAt;
        current.latestSaleAmount = row.amount;
      }
    } else {
      current.refundCount += 1;
      current.grossRefunds += row.amount;
    }

    current.netPurchases += getSignedPurchases(row.type);
    current.netRevenue += getSignedRevenue(row.type, row.amount);
    current.shouldUpdatePrice =
      current.latestSaleAmount > 0 &&
      (!existing || existing.price !== current.latestSaleAmount);

    summaries.set(row.title, current);
  });

  return Array.from(summaries.values())
    .map((summary) => ({
      title: summary.title,
      contentType: summary.contentType,
      status: summary.status,
      articleId: summary.articleId,
      salesCount: summary.salesCount,
      refundCount: summary.refundCount,
      netPurchases: summary.netPurchases,
      grossSales: summary.grossSales,
      grossRefunds: summary.grossRefunds,
      netRevenue: summary.netRevenue,
      latestSaleAmount: summary.latestSaleAmount,
      shouldUpdatePrice: summary.shouldUpdatePrice,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "ja"));
}

export function summarizeRows(rows: ParsedNoteSaleRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.type === "販売") {
        summary.salesCount += 1;
        summary.grossSales += row.amount;
      } else {
        summary.refundCount += 1;
        summary.grossRefunds += row.amount;
      }

      summary.netRevenue += getSignedRevenue(row.type, row.amount);
      summary.netPurchases += getSignedPurchases(row.type);

      return summary;
    },
    {
      salesCount: 0,
      refundCount: 0,
      grossSales: 0,
      grossRefunds: 0,
      netRevenue: 0,
      netPurchases: 0,
    },
  );
}
