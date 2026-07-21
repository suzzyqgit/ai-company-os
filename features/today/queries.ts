import { prisma } from "@/lib/prisma";
import { getTodayAiImprovements } from "@/features/ai-improvements/queries";
import { getContentGapAnalysis } from "@/features/content-gap/queries";
import {
  compareFreeArticleEvaluations,
  evaluateFreeArticle,
} from "@/features/free-articles/evaluation";
import { generateFreeArticleImprovementSuggestions } from "@/features/free-articles/improvements";
import { getFreeArticlePipelineDraftStatusByArticle } from "@/features/free-articles/queries";
import {
  getTodayFreeArticleStatusRank,
  normalizeFreeArticleStatus,
} from "@/features/free-articles/status";
import { buildTodayAdvisorRecommendation } from "./advisor";
import {
  applyFreeArticlePipelineStatus,
  buildChecklistItems,
  buildPrimaryTask,
  getTodayTokyoDate,
  getWeekStartTokyoDate,
  pickTodayFreeArticlePlan,
  pickTodayImprovementArticle,
  todayPurchaseGoal,
  type TodayFreeArticleImprovementCandidate,
  type TodayPrePublishFreeArticle,
  type TodayRecentUpdate,
  type TodayRevenueActionQueueItem,
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
    prePublishDrafts,
    publishedFreeDrafts,
    recentAiRuns,
    recentSyncedArticles,
    revenueActionQueueCandidates,
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
    prisma.freeArticleDraft.findMany({
      where: {
        status: {
          in: ["DRAFT", "REVIEW", "READY"],
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
      take: 10,
    }),
    prisma.freeArticleDraft.findMany({
      where: {
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        publishedPv: true,
        referralCount: true,
        purchaseCount: true,
        improvementCount: true,
        publishedAt: true,
        updatedAt: true,
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
    prisma.revenueTask.findMany({
      where: {
        status: {
          in: ["TODO", "DOING"],
        },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        article: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
  ]);
  const revenueActionQueueItems = revenueActionQueueCandidates
    .slice(0, 5)
    .map(
      (task): TodayRevenueActionQueueItem => ({
        id: task.id,
        title: task.title,
        status: task.status === "DOING" ? "DOING" : "TODO",
        priority: task.priority,
        createdAt: task.createdAt,
        article: task.article,
      }),
    );
  const completedKeys = new Set(completions.map((completion) => completion.taskKey));
  const prePublishArticles = prePublishDrafts
    .map((draft) => ({
      id: draft.id,
      title: draft.title,
      status: normalizeFreeArticleStatus(draft.status),
      updatedAt: draft.updatedAt,
      href: `/free-articles/${draft.id}`,
    }))
    .filter(
      (draft): draft is TodayPrePublishFreeArticle =>
        draft.status === "DRAFT" ||
        draft.status === "REVIEW" ||
        draft.status === "READY",
    )
    .sort((left, right) => {
      const statusDiff =
        getTodayFreeArticleStatusRank(right.status) -
        getTodayFreeArticleStatusRank(left.status);

      if (statusDiff !== 0) {
        return statusDiff;
      }

      const updatedAtDiff = right.updatedAt.getTime() - left.updatedAt.getTime();

      if (updatedAtDiff !== 0) {
        return updatedAtDiff;
      }

      return left.id.localeCompare(right.id);
    })
    .slice(0, 5);
  const checklistItems = buildChecklistItems(completedKeys).filter(
    (item) =>
      item.key !== "complete-publish-checklist" || prePublishArticles.length > 0,
  );
  const freeArticleImprovementCandidates = publishedFreeDrafts
    .map((draft) => ({
      id: draft.id,
      title: draft.title,
      publishedPv: draft.publishedPv,
      referralCount: draft.referralCount,
      purchaseCount: draft.purchaseCount,
      improvementCount: draft.improvementCount,
      publishedAt: draft.publishedAt,
      updatedAt: draft.updatedAt,
      evaluation: evaluateFreeArticle({
        id: draft.id,
        title: draft.title,
        publishedPv: draft.publishedPv,
        referralCount: draft.referralCount,
        purchaseCount: draft.purchaseCount,
        improvementCount: draft.improvementCount,
        publishedAt: draft.publishedAt,
        updatedAt: draft.updatedAt,
      }),
      href: `/free-articles/${draft.id}`,
    }))
    .map((draft) => ({
      ...draft,
      improvementSuggestions: generateFreeArticleImprovementSuggestions({
        id: draft.id,
        title: draft.title,
        publishedPv: draft.publishedPv,
        referralCount: draft.referralCount,
        purchaseCount: draft.purchaseCount,
        improvementCount: draft.improvementCount,
        publishedAt: draft.publishedAt,
        updatedAt: draft.updatedAt,
        evaluation: draft.evaluation,
      }),
    }))
    .filter(
      (draft) =>
        draft.evaluation.phase === "formal" &&
        (draft.evaluation.grade === "D" ||
          draft.evaluation.grade === "C" ||
          draft.evaluation.grade === "B"),
    )
    .sort(compareFreeArticleEvaluations)
    .slice(0, 5)
    .map(
      ({
        id,
        title,
        publishedPv,
        referralCount,
        purchaseCount,
        improvementCount,
        evaluation,
        improvementSuggestions,
        href,
      }): TodayFreeArticleImprovementCandidate => ({
        id,
        title,
        publishedPv,
        referralCount,
        purchaseCount,
        improvementCount,
        evaluation,
        improvementSuggestions,
        href,
      }),
    );
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
      : applyFreeArticlePipelineStatus(
          baseFreeArticlePlan,
          pipelineDraft?.status ?? null,
          pipelineDraft?.improvementCount ?? null,
        );
  const improvementArticle = pickTodayImprovementArticle(improvements);
  const primaryTask = buildPrimaryTask({
    freeArticlePlan,
  });
  const latestOcrAt = recentOcrRuns[0]?.createdAt ?? null;
  const latestCsvAt = recentCsvTransactions[0]?.createdAt ?? null;
  const advisorRecommendation = buildTodayAdvisorRecommendation({
    today,
    todayKpis,
    improvementArticle,
    freeArticlePlan,
    contentGaps: contentGapAnalysis.gaps,
    latestOcrAt,
    latestCsvAt,
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
    advisorRecommendation,
    primaryTask,
    checklistItems,
    improvementArticle,
    freeArticlePlan,
    freeArticleImprovementCandidates,
    prePublishArticles,
    todayKpis,
    recentUpdates,
    revenueActionQueueItems,
    hasMoreRevenueActionQueueItems: revenueActionQueueCandidates.length > 5,
  };
}
