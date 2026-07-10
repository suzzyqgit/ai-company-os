import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateArticleTotalFromDailyMetrics } from "./calculators";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

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
      };
    })
    .filter((row) => !filledOnly || row.hasMetric);
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
