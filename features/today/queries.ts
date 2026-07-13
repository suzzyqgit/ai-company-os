import { prisma } from "@/lib/prisma";
import { getTodayAiImprovements } from "@/features/ai-improvements/queries";
import { getContentGapAnalysis } from "@/features/content-gap/queries";
import { getFreeArticlePipelineDraftStatusByArticle } from "@/features/free-articles/queries";
import {
  applyFreeArticlePipelineStatus,
  buildChecklistItems,
  buildPrimaryTask,
  getTodayTokyoDate,
  getWeekStartTokyoDate,
  pickTodayFreeArticlePlan,
  pickTodayImprovementArticle,
  todayPurchaseGoal,
  type TodayRecentUpdate,
} from "./calculators";

function toRecentUpdate(update: TodayRecentUpdate) {
  return update;
}

export async function getTodayData() {
  const today = getTodayTokyoDate();
  const weekStart = getWeekStartTokyoDate(today);
  const [
    completions,
    todayMetrics,
    weekMetrics,
    improvements,
    contentGapAnalysis,
    recentOcrRuns,
    recentCsvTransactions,
    recentFreeDrafts,
    recentAiRuns,
    recentSyncedArticles,
  ] = await Promise.all([
    prisma.todayTaskCompletion.findMany({
      where: {
        date: today,
        completed: true,
      },
      select: {
        taskKey: true,
      },
    }),
    prisma.articleDailyMetric.findMany({
      where: {
        date: today,
      },
      select: {
        pv: true,
        purchases: true,
        revenue: true,
      },
    }),
    prisma.articleDailyMetric.findMany({
      where: {
        date: {
          gte: weekStart,
          lte: today,
        },
      },
      select: {
        purchases: true,
        revenue: true,
      },
    }),
    getTodayAiImprovements(),
    getContentGapAnalysis(),
    prisma.articleAccessImportRun.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        sourceFileCount: true,
        createdAt: true,
      },
    }),
    prisma.noteSaleTransaction.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    }),
    prisma.freeArticleDraft.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    }),
    prisma.aiAnalysisRun.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        article: {
          select: {
            title: true,
          },
        },
      },
    }),
    prisma.article.findMany({
      where: {
        noteUrl: {
          not: "",
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    }),
  ]);
  const completedKeys = new Set(completions.map((completion) => completion.taskKey));
  const checklistItems = buildChecklistItems(completedKeys);
  const todayKpis = {
    todayRevenue: todayMetrics.reduce((total, metric) => total + metric.revenue, 0),
    todayPv: todayMetrics.reduce((total, metric) => total + metric.pv, 0),
    todayPurchases: todayMetrics.reduce((total, metric) => total + metric.purchases, 0),
    weekRevenue: weekMetrics.reduce((total, metric) => total + metric.revenue, 0),
    weekPurchases: weekMetrics.reduce((total, metric) => total + metric.purchases, 0),
    remainingPurchasesToGoal: Math.max(
      0,
      todayPurchaseGoal -
        todayMetrics.reduce((total, metric) => total + metric.purchases, 0),
    ),
  };
  const baseFreeArticlePlan = pickTodayFreeArticlePlan(contentGapAnalysis.gaps);
  const pipelineDraft = baseFreeArticlePlan
    ? await getFreeArticlePipelineDraftStatusByArticle(
        baseFreeArticlePlan.destinationArticleId,
      )
    : null;
  const freeArticlePlan =
    baseFreeArticlePlan === null
      ? null
      : applyFreeArticlePipelineStatus(baseFreeArticlePlan, pipelineDraft?.status ?? null);
  const improvementArticle = pickTodayImprovementArticle(improvements);
  const primaryTask = buildPrimaryTask({
    freeArticlePlan,
  });
  const recentUpdates = [
    ...recentOcrRuns.map((run) =>
      toRecentUpdate({
        id: `ocr-${run.id}`,
        type: "OCR",
        title: `${run.sourceFileCount}件の画像を取り込み`,
        at: run.createdAt,
        href: "/imports/note-access",
      }),
    ),
    ...recentCsvTransactions.map((transaction) =>
      toRecentUpdate({
        id: `csv-${transaction.id}`,
        type: "CSV",
        title: transaction.title,
        at: transaction.createdAt,
        href: "/imports/note-sales",
      }),
    ),
    ...recentFreeDrafts.map((draft) =>
      toRecentUpdate({
        id: `free-${draft.id}`,
        type: "無料記事",
        title: draft.title,
        at: draft.createdAt,
        href: "/free-article-generator",
      }),
    ),
    ...recentAiRuns.map((run) =>
      toRecentUpdate({
        id: `ai-${run.id}`,
        type: "AI改善",
        title: run.article.title,
        at: run.createdAt,
        href: "/ai-improvements",
      }),
    ),
    ...recentSyncedArticles.map((article) =>
      toRecentUpdate({
        id: `profile-${article.id}`,
        type: "公開記事同期",
        title: article.title,
        at: article.updatedAt,
        href: "/imports/note-profile",
      }),
    ),
  ]
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, 5);

  return {
    primaryTask,
    checklistItems,
    improvementArticle,
    freeArticlePlan,
    todayKpis,
    recentUpdates,
  };
}
