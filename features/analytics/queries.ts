import { prisma } from "@/lib/prisma";
import {
  addMetricTotals,
  createEmptyTotals,
  getDailyRows,
  type AnalyticsPeriod,
  type ArticleMetricSummary,
  type DailyMetricSummary,
  type MetricTotals,
} from "./calculators";
import { formatTokyoDateInputValue } from "@/features/metrics/calculators";

type MetricWithArticle = Awaited<ReturnType<typeof getMetricsForPeriod>>[number];

export function getMetricsForPeriod(from: Date, exclusiveTo: Date) {
  return prisma.articleDailyMetric.findMany({
    where: {
      date: {
        gte: from,
        lt: exclusiveTo,
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
    orderBy: {
      date: "desc",
    },
  });
}

function metricToTotals(metric: MetricWithArticle): MetricTotals {
  return {
    pv: metric.pv,
    purchases: metric.purchases,
    revenue: metric.revenue,
    masterTransitions: metric.masterTransitions,
  };
}

export function summarizeTotals(metrics: MetricWithArticle[]) {
  return metrics.reduce((totals, metric) => {
    addMetricTotals(totals, metricToTotals(metric));
    return totals;
  }, createEmptyTotals());
}

export function summarizeDailyMetrics(
  period: AnalyticsPeriod,
  metrics: MetricWithArticle[],
): DailyMetricSummary[] {
  const rows = getDailyRows(period);
  const rowMap = new Map(rows.map((row) => [row.dateInput, row]));

  metrics.forEach((metric) => {
    const key = formatTokyoDateInputValue(metric.date);
    const row = rowMap.get(key);

    if (row) {
      addMetricTotals(row, metricToTotals(metric));
    }
  });

  return rows;
}

export function summarizeArticleMetrics(
  metrics: MetricWithArticle[],
): ArticleMetricSummary[] {
  const articleMap = new Map<string, ArticleMetricSummary>();

  metrics.forEach((metric) => {
    const current = articleMap.get(metric.articleId) ?? {
      articleId: metric.articleId,
      title: metric.article.title,
      ...createEmptyTotals(),
    };

    addMetricTotals(current, metricToTotals(metric));
    articleMap.set(metric.articleId, current);
  });

  return Array.from(articleMap.values());
}

export async function getAnalyticsData(period: AnalyticsPeriod) {
  const [currentMetrics, previousMetrics] = await Promise.all([
    getMetricsForPeriod(period.from, period.exclusiveTo),
    getMetricsForPeriod(period.previousFrom, period.previousExclusiveTo),
  ]);

  const currentTotals = summarizeTotals(currentMetrics);
  const previousTotals = summarizeTotals(previousMetrics);
  const dailyRows = summarizeDailyMetrics(period, currentMetrics);
  const articleRows = summarizeArticleMetrics(currentMetrics);

  return {
    currentTotals,
    previousTotals,
    dailyRows,
    articleRows,
  };
}
