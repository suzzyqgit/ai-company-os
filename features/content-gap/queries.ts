import { prisma } from "@/lib/prisma";
import { analyzeContentGaps, getContentGapSummary } from "./calculators";

export async function getContentGapAnalysis() {
  const [paidArticles, publishedFreeArticles] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "active",
        price: 980,
      },
      include: {
        freeArticleIdeas: true,
        freeArticleDrafts: true,
        noteSaleTransactions: {
          select: {
            amount: true,
          },
        },
        accessImportItems: {
          select: {
            extractedPv: true,
            nextPv: true,
          },
        },
        aiAnalysisRuns: {
          select: {
            outputText: true,
            outputJson: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.article.findMany({
      where: {
        status: "active",
        price: 0,
      },
      select: {
        title: true,
        note: true,
        pv: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);
  const gaps = analyzeContentGaps({
    paidArticles,
    publishedFreeArticles,
  });

  return {
    gaps,
    summary: getContentGapSummary(gaps),
  };
}
