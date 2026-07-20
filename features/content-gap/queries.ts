import { prisma } from "@/lib/prisma";
import { analyzeContentGaps, getContentGapSummary } from "./calculators";

export async function getContentGapAnalysis() {
  const [paidArticles, publishedFreeArticles, publishedFreeDrafts] = await Promise.all([
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
    prisma.freeArticleDraft.findMany({
      where: {
        status: "PUBLISHED",
      },
      select: {
        destinationArticleId: true,
        title: true,
        theme: true,
        body: true,
        fullDraft: true,
        publishedPv: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);
  const gaps = analyzeContentGaps({
    paidArticles,
    publishedFreeArticles: [
      ...publishedFreeArticles,
      ...publishedFreeDrafts
        .filter((draft) => draft.destinationArticleId !== null)
        .map((draft) => ({
          destinationArticleId: draft.destinationArticleId,
          title: draft.title,
          note: `${draft.theme}\n${draft.body || draft.fullDraft}`,
          pv: draft.publishedPv,
          updatedAt: draft.updatedAt,
        })),
    ],
  });

  return {
    gaps,
    summary: getContentGapSummary(gaps),
  };
}
