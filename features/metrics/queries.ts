import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateArticleTotalFromDailyMetrics } from "./calculators";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type CsvSalesTotals = {
  hasTransactions: boolean;
  purchases: number;
  revenue: number;
};

export type CumulativePvSnapshotResult = {
  previousPv: number;
  nextPv: number;
  status: "updated" | "unchanged" | "warning_decrease";
  warning?: string;
};

function getSignedPurchases(type: string) {
  return type === "返金" ? -1 : 1;
}

function getSignedRevenue(type: string, amount: number) {
  return type === "返金" ? -amount : amount;
}

export function getArticleDailyMetrics(articleId: string) {
  return prisma.articleDailyMetric.findMany({
    where: { articleId },
    orderBy: {
      date: "desc",
    },
  });
}

export async function getDailyMetricInputRows({
  date,
  query,
  filledOnly,
}: {
  date: Date;
  query: string;
  filledOnly: boolean;
}) {
  const articles = await prisma.article.findMany({
    where: query
      ? {
          title: {
            contains: query,
          },
        }
      : {},
    include: {
      dailyMetrics: {
        where: { date },
        take: 1,
      },
      noteSaleTransactions: {
        where: { date },
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return articles
    .map((article) => {
      const metric = article.dailyMetrics[0] ?? null;

      return {
        article,
        metric,
        hasMetric: metric !== null,
        hasCsvSales: article.noteSaleTransactions.length > 0,
      };
    })
    .filter((row) => !filledOnly || row.hasMetric);
}

export async function getCsvSalesTotalsForArticleDate(
  articleId: string,
  date: Date,
  client: PrismaTransaction = prisma,
): Promise<CsvSalesTotals> {
  const transactions = await client.noteSaleTransaction.findMany({
    where: {
      articleId,
      date,
    },
    select: {
      type: true,
      amount: true,
    },
  });

  return {
    hasTransactions: transactions.length > 0,
    purchases: transactions.reduce(
      (total, transaction) => total + getSignedPurchases(transaction.type),
      0,
    ),
    revenue: transactions.reduce(
      (total, transaction) =>
        total + getSignedRevenue(transaction.type, transaction.amount),
      0,
    ),
  };
}

export async function getCsvSalesTotalsByArticleIdsForDate({
  articleIds,
  date,
}: {
  articleIds: string[];
  date: Date;
}) {
  if (articleIds.length === 0) {
    return new Map<string, CsvSalesTotals>();
  }

  const transactions = await prisma.noteSaleTransaction.findMany({
    where: {
      articleId: {
        in: articleIds,
      },
      date,
    },
    select: {
      articleId: true,
      type: true,
      amount: true,
    },
  });
  const totalsByArticleId = new Map<string, CsvSalesTotals>();

  transactions.forEach((transaction) => {
    const current = totalsByArticleId.get(transaction.articleId) ?? {
      hasTransactions: true,
      purchases: 0,
      revenue: 0,
    };

    current.purchases += getSignedPurchases(transaction.type);
    current.revenue += getSignedRevenue(transaction.type, transaction.amount);
    totalsByArticleId.set(transaction.articleId, current);
  });

  return totalsByArticleId;
}

export async function syncArticleTotalsFromDailyMetrics(
  articleId: string,
  client: PrismaTransaction = prisma,
) {
  const article = await client.article.findUnique({
    where: { id: articleId },
    select: {
      baselinePv: true,
      baselinePurchases: true,
    },
  });

  if (!article) {
    throw new Error("Article not found");
  }

  const totals = await client.articleDailyMetric.aggregate({
    where: { articleId },
    _sum: {
      pv: true,
      purchases: true,
    },
  });

  const nextTotals = calculateArticleTotalFromDailyMetrics({
    baselinePv: article.baselinePv,
    baselinePurchases: article.baselinePurchases,
    dailyPv: totals._sum.pv ?? 0,
    dailyPurchases: totals._sum.purchases ?? 0,
  });

  return client.article.update({
    where: { id: articleId },
    data: nextTotals satisfies Prisma.ArticleUpdateInput,
  });
}

export async function applyCumulativePvSnapshotToArticle({
  articleId,
  cumulativePv,
  client = prisma,
}: {
  articleId: string;
  cumulativePv: number;
  client?: PrismaTransaction;
}): Promise<CumulativePvSnapshotResult> {
  const article = await client.article.findUnique({
    where: { id: articleId },
    select: {
      pv: true,
    },
  });

  if (!article) {
    throw new Error("Article not found");
  }

  if (cumulativePv < article.pv) {
    return {
      previousPv: article.pv,
      nextPv: cumulativePv,
      status: "warning_decrease",
      warning: `抽出PVが現在値 ${article.pv} より小さいため、Article.pvは更新していません。`,
    };
  }

  if (cumulativePv === article.pv) {
    return {
      previousPv: article.pv,
      nextPv: cumulativePv,
      status: "unchanged",
    };
  }

  const totals = await client.articleDailyMetric.aggregate({
    where: { articleId },
    _sum: {
      pv: true,
    },
  });
  const dailyPv = totals._sum.pv ?? 0;
  const nextBaselinePv = cumulativePv - dailyPv;

  if (nextBaselinePv < 0) {
    return {
      previousPv: article.pv,
      nextPv: cumulativePv,
      status: "warning_decrease",
      warning: `抽出PVが日次PV合計 ${dailyPv} より小さいため、累計PVの正本を更新できません。`,
    };
  }

  await client.article.update({
    where: { id: articleId },
    data: {
      baselinePv: nextBaselinePv,
    },
  });
  await syncArticleTotalsFromDailyMetrics(articleId, client);

  return {
    previousPv: article.pv,
    nextPv: cumulativePv,
    status: "updated",
  };
}
