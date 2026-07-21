import { prisma } from "@/lib/prisma";
import {
  addRevenueReviewDays,
  buildRevenueReviewEvidence,
  compareRevenueReviewQueueItems,
  getRevenueReviewDaysSinceCompletion,
  getRevenueReviewNextAction,
  getRevenueReviewPeriods,
  getRevenueReviewPhase,
  getRevenueReviewResult,
  REVENUE_REVIEW_WINDOW_DAYS,
  type RevenueReviewQueueItem,
} from "./review";

type RevenueReviewTask = {
  id: string;
  title: string;
  type: RevenueReviewQueueItem["taskType"];
  priority: number;
  articleId: string | null;
  article: {
    id: string;
    title: string;
  } | null;
  completedAt: Date | null;
  createdAt: Date;
};

type RevenueMetric = {
  articleId: string;
  date: Date;
  pv: number;
  purchases: number;
  revenue: number;
};

function isReviewableRevenueTask(
  task: RevenueReviewTask,
): task is RevenueReviewTask & {
  articleId: string;
  completedAt: Date;
} {
  return task.articleId !== null && task.completedAt !== null;
}

function groupRevenueMetricsByArticle(metrics: RevenueMetric[]) {
  const metricsByArticleId = new Map<string, RevenueMetric[]>();

  for (const metric of metrics) {
    const articleMetrics = metricsByArticleId.get(metric.articleId) ?? [];
    articleMetrics.push(metric);
    metricsByArticleId.set(metric.articleId, articleMetrics);
  }

  return metricsByArticleId;
}

export async function getRevenueReviewQueue(today: Date) {
  const reviewWindowStart = addRevenueReviewDays(
    today,
    -REVENUE_REVIEW_WINDOW_DAYS,
  );
  const rawTasks: RevenueReviewTask[] = await prisma.revenueTask.findMany({
      where: {
        status: "DONE",
        completedAt: {
          not: null,
          gte: reviewWindowStart,
        },
        articleId: {
          not: null,
        },
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { completedAt: "desc" },
        { createdAt: "desc" },
        { id: "asc" },
      ],
    });
  const tasks = rawTasks.filter(isReviewableRevenueTask);

  if (tasks.length === 0) {
    return [];
  }

  const taskPeriods: Array<{
    task: RevenueReviewTask & {
      articleId: string;
      completedAt: Date;
    };
    periods: NonNullable<ReturnType<typeof getRevenueReviewPeriods>>;
  }> = [];

  for (const task of tasks) {
    const periods = getRevenueReviewPeriods(task.completedAt);

    if (periods !== null) {
      taskPeriods.push({
        task,
        periods,
      });
    }
  }

  if (taskPeriods.length === 0) {
    return [];
  }

  const articleIds = [...new Set(taskPeriods.map(({ task }) => task.articleId))];
  const earliestBeforeFrom = taskPeriods.reduce(
    (earliest, { periods }) =>
      periods.beforeFrom < earliest ? periods.beforeFrom : earliest,
    taskPeriods[0].periods.beforeFrom,
  );
  const latestAfterExclusiveTo = taskPeriods.reduce(
    (latest, { periods }) =>
      periods.afterExclusiveTo > latest ? periods.afterExclusiveTo : latest,
    taskPeriods[0].periods.afterExclusiveTo,
  );
  const metrics = await prisma.articleDailyMetric.findMany({
    where: {
      articleId: {
        in: articleIds,
      },
      date: {
        gte: earliestBeforeFrom,
        lt: latestAfterExclusiveTo,
      },
    },
    select: {
      articleId: true,
      date: true,
      pv: true,
      purchases: true,
      revenue: true,
    },
  });
  const metricsByArticleId = groupRevenueMetricsByArticle(metrics);

  return taskPeriods
    .map(({ task, periods }): RevenueReviewQueueItem => {
      const articleMetrics = metricsByArticleId.get(task.articleId) ?? [];
      const beforeMetrics = articleMetrics.filter(
        (metric) =>
          metric.date >= periods.beforeFrom &&
          metric.date < periods.beforeExclusiveTo,
      );
      const afterMetrics = articleMetrics.filter(
        (metric) =>
          metric.date >= periods.afterFrom &&
          metric.date < periods.afterExclusiveTo,
      );
      const evidence = buildRevenueReviewEvidence({
        beforeMetrics,
        afterMetrics,
      });
      const daysSinceCompletion = getRevenueReviewDaysSinceCompletion({
        completedAt: task.completedAt,
        today,
      });
      const phase = getRevenueReviewPhase(daysSinceCompletion);
      const result = getRevenueReviewResult({
        phase,
        evidence,
      });

      return {
        taskId: task.id,
        taskTitle: task.title,
        taskType: task.type,
        priority: task.priority,
        articleId: task.articleId,
        articleTitle: task.article?.title ?? null,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
        daysSinceCompletion,
        beforePeriod: periods.beforePeriod,
        afterPeriod: periods.afterPeriod,
        phase,
        result,
        nextAction: getRevenueReviewNextAction({
          phase,
          result,
        }),
        evidence,
      };
    })
    .sort(compareRevenueReviewQueueItems);
}
