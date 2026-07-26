import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import {
  buildBlockingIssues,
  buildCurrentCaseStatus,
  buildOwnerActionItems,
  buildReadinessItems,
  type ExecutiveWorkflowInput,
} from "./calculators";

type CountByStatus = {
  approvalStatus: string;
  _count: {
    _all: number;
  };
};

function parseCsvDataRowCount(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1).length;
}

async function readCsvRowCount(path: string) {
  try {
    return parseCsvDataRowCount(await readFile(path, "utf8"));
  } catch {
    return 0;
  }
}

async function countGovernanceDocuments() {
  try {
    const entries = await readdir(join(process.cwd(), "docs/governance"), {
      withFileTypes: true,
    });
    return entries.filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"),
    ).length;
  } catch {
    return 0;
  }
}

function getStatusCount(rows: CountByStatus[], status: string) {
  return rows.find((row) => row.approvalStatus === status)?._count._all ?? 0;
}

export async function getExecutiveWorkflowData() {
  const [
    importRunCount,
    importSourceCount,
    canonicalSalesRecordCount,
    canonicalSalesByApprovalStatus,
    productCount,
    saleCount,
    saleItemCount,
    promotionRunCount,
    articleCount,
    articleDailyMetricCount,
    revenueTaskCount,
    openRevenueTaskCount,
    agentRegistryCount,
    conversationCount,
    agentMessageCount,
    governanceDocumentCount,
    staticArticleCount,
    staticArticleMetricCount,
    staticMonthlySalesCount,
  ] = await Promise.all([
    prisma.importRun.count(),
    prisma.importSource.count(),
    prisma.canonicalSalesRecord.count(),
    prisma.canonicalSalesRecord.groupBy({
      by: ["approvalStatus"],
      _count: {
        _all: true,
      },
    }),
    prisma.product.count(),
    prisma.sale.count(),
    prisma.saleItem.count(),
    prisma.promotionRun.count(),
    prisma.article.count(),
    prisma.articleDailyMetric.count(),
    prisma.revenueTask.count(),
    prisma.revenueTask.count({
      where: {
        status: {
          in: ["TODO", "DOING"],
        },
      },
    }),
    prisma.agentRegistry.count(),
    prisma.conversation.count(),
    prisma.agentMessage.count(),
    countGovernanceDocuments(),
    readCsvRowCount(join(process.cwd(), "data/note/articles/articles.csv")),
    readCsvRowCount(join(process.cwd(), "data/note/articles/article_metrics.csv")),
    readCsvRowCount(join(process.cwd(), "data/note/sales/monthly_sales.csv")),
  ]);

  const input: ExecutiveWorkflowInput = {
    importRunCount,
    importSourceCount,
    canonicalSalesRecordCount,
    pendingCanonicalSalesRecordCount: getStatusCount(
      canonicalSalesByApprovalStatus,
      "PENDING",
    ),
    approvedCanonicalSalesRecordCount: getStatusCount(
      canonicalSalesByApprovalStatus,
      "APPROVED",
    ),
    productCount,
    saleCount,
    saleItemCount,
    promotionRunCount,
    articleCount,
    articleDailyMetricCount,
    revenueTaskCount,
    openRevenueTaskCount,
    agentRegistryCount,
    conversationCount,
    agentMessageCount,
    governanceDocumentCount,
    staticArticleCount,
    staticArticleMetricCount,
    staticMonthlySalesCount,
  };

  return {
    input,
    ownerActionItems: buildOwnerActionItems(input),
    currentCaseStatus: buildCurrentCaseStatus(input),
    readinessItems: buildReadinessItems(input),
    blockingIssues: buildBlockingIssues(input),
  };
}
