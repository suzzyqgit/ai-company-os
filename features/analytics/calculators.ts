import {
  formatTokyoDateInputValue,
  normalizeDateInputToTokyoDate,
} from "@/features/metrics/calculators";

export type AnalyticsRange =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export type AnalyticsPeriod = {
  range: AnalyticsRange;
  fromInput: string;
  toInput: string;
  from: Date;
  to: Date;
  exclusiveTo: Date;
  days: number;
  previousFrom: Date;
  previousTo: Date;
  previousExclusiveTo: Date;
  previousFromInput: string;
  previousToInput: string;
};

export type MetricTotals = {
  pv: number;
  purchases: number;
  revenue: number;
  masterTransitions: number;
};

export type DailyMetricSummary = MetricTotals & {
  date: Date;
  dateInput: string;
};

export type ArticleMetricSummary = MetricTotals & {
  articleId: string;
  title: string;
};

export type ComparisonMetric = {
  label: string;
  current: number;
  previous: number;
  delta: number;
  changeRate: number | null;
  type: "currency" | "number" | "rate";
};

export type ImprovementArticle = ArticleMetricSummary & {
  priority: "高" | "中";
  score: number;
};

const validRanges: AnalyticsRange[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "thisMonth",
  "lastMonth",
  "custom",
];

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function divideRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

export function getPurchaseRate(metrics: MetricTotals) {
  return divideRate(metrics.purchases, metrics.pv);
}

export function getMasterTransitionRate(metrics: MetricTotals) {
  return divideRate(metrics.masterTransitions, metrics.purchases);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function getTokyoDateParts(date: Date) {
  const [year, month, day] = formatTokyoDateInputValue(date)
    .split("-")
    .map(Number);

  return { year, month, day };
}

function createTokyoDate(year: number, month: number, day: number) {
  const date = normalizeDateInputToTokyoDate(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );

  if (date === null) {
    throw new Error("Invalid Tokyo date");
  }

  return date;
}

function getMonthStart(date: Date) {
  const { year, month } = getTokyoDateParts(date);
  return createTokyoDate(year, month, 1);
}

function getDefaultRange(value: string | undefined): AnalyticsRange {
  return validRanges.includes(value as AnalyticsRange)
    ? (value as AnalyticsRange)
    : "7d";
}

function countDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / millisecondsPerDay) + 1;
}

function buildPeriod(range: AnalyticsRange, from: Date, to: Date): AnalyticsPeriod {
  const days = countDays(from, to);
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(days - 1));

  return {
    range,
    from,
    to,
    exclusiveTo: addDays(to, 1),
    fromInput: formatTokyoDateInputValue(from),
    toInput: formatTokyoDateInputValue(to),
    days,
    previousFrom,
    previousTo,
    previousExclusiveTo: addDays(previousTo, 1),
    previousFromInput: formatTokyoDateInputValue(previousFrom),
    previousToInput: formatTokyoDateInputValue(previousTo),
  };
}

export function resolveAnalyticsPeriod({
  range: rawRange,
  from: rawFrom,
  to: rawTo,
  now = new Date(),
}: {
  range?: string;
  from?: string;
  to?: string;
  now?: Date;
}) {
  const range = getDefaultRange(rawRange);
  const today = normalizeDateInputToTokyoDate(formatTokyoDateInputValue(now));

  if (today === null) {
    throw new Error("Failed to resolve today");
  }

  if (range === "today") {
    return buildPeriod(range, today, today);
  }

  if (range === "yesterday") {
    const yesterday = addDays(today, -1);
    return buildPeriod(range, yesterday, yesterday);
  }

  if (range === "30d") {
    return buildPeriod(range, addDays(today, -29), today);
  }

  if (range === "thisMonth") {
    return buildPeriod(range, getMonthStart(today), today);
  }

  if (range === "lastMonth") {
    const thisMonthStart = getMonthStart(today);
    const lastMonthEnd = addDays(thisMonthStart, -1);
    return buildPeriod(range, getMonthStart(lastMonthEnd), lastMonthEnd);
  }

  if (range === "custom") {
    const from = rawFrom ? normalizeDateInputToTokyoDate(rawFrom) : null;
    const to = rawTo ? normalizeDateInputToTokyoDate(rawTo) : null;

    if (from !== null && to !== null && from.getTime() <= to.getTime()) {
      return buildPeriod(range, from, to);
    }
  }

  return buildPeriod("7d", addDays(today, -6), today);
}

export function createEmptyTotals(): MetricTotals {
  return {
    pv: 0,
    purchases: 0,
    revenue: 0,
    masterTransitions: 0,
  };
}

export function addMetricTotals(target: MetricTotals, source: MetricTotals) {
  target.pv += source.pv;
  target.purchases += source.purchases;
  target.revenue += source.revenue;
  target.masterTransitions += source.masterTransitions;
}

export function getDailyRows(period: AnalyticsPeriod) {
  return Array.from({ length: period.days }, (_, index) => {
    const date = addDays(period.from, index);

    return {
      date,
      dateInput: formatTokyoDateInputValue(date),
      ...createEmptyTotals(),
    };
  }).reverse();
}

export function getComparisonMetrics(
  current: MetricTotals,
  previous: MetricTotals,
): ComparisonMetric[] {
  const currentPurchaseRate = getPurchaseRate(current);
  const previousPurchaseRate = getPurchaseRate(previous);
  const currentMasterRate = getMasterTransitionRate(current);
  const previousMasterRate = getMasterTransitionRate(previous);

  return [
    {
      label: "売上",
      current: current.revenue,
      previous: previous.revenue,
      delta: current.revenue - previous.revenue,
      changeRate:
        previous.revenue === 0
          ? null
          : divideRate(current.revenue - previous.revenue, previous.revenue),
      type: "currency",
    },
    {
      label: "PV",
      current: current.pv,
      previous: previous.pv,
      delta: current.pv - previous.pv,
      changeRate:
        previous.pv === 0 ? null : divideRate(current.pv - previous.pv, previous.pv),
      type: "number",
    },
    {
      label: "購入数",
      current: current.purchases,
      previous: previous.purchases,
      delta: current.purchases - previous.purchases,
      changeRate:
        previous.purchases === 0
          ? null
          : divideRate(current.purchases - previous.purchases, previous.purchases),
      type: "number",
    },
    {
      label: "購入率",
      current: currentPurchaseRate,
      previous: previousPurchaseRate,
      delta: currentPurchaseRate - previousPurchaseRate,
      changeRate:
        previousPurchaseRate === 0
          ? null
          : divideRate(currentPurchaseRate - previousPurchaseRate, previousPurchaseRate),
      type: "rate",
    },
    {
      label: "Master遷移数",
      current: current.masterTransitions,
      previous: previous.masterTransitions,
      delta: current.masterTransitions - previous.masterTransitions,
      changeRate:
        previous.masterTransitions === 0
          ? null
          : divideRate(
              current.masterTransitions - previous.masterTransitions,
              previous.masterTransitions,
            ),
      type: "number",
    },
    {
      label: "Master遷移率",
      current: currentMasterRate,
      previous: previousMasterRate,
      delta: currentMasterRate - previousMasterRate,
      changeRate:
        previousMasterRate === 0
          ? null
          : divideRate(currentMasterRate - previousMasterRate, previousMasterRate),
      type: "rate",
    },
  ];
}

export function getTopArticles(
  articles: ArticleMetricSummary[],
  sortBy: keyof Pick<
    ArticleMetricSummary,
    "pv" | "purchases" | "revenue" | "masterTransitions"
  >,
) {
  return [...articles]
    .sort((a, b) => {
      if (a[sortBy] !== b[sortBy]) {
        return b[sortBy] - a[sortBy];
      }

      return b.revenue - a.revenue;
    })
    .slice(0, 5);
}

export function getTopArticlesByPurchaseRate(articles: ArticleMetricSummary[]) {
  return [...articles]
    .filter((article) => article.pv >= 10)
    .sort((a, b) => {
      const rateA = getPurchaseRate(a);
      const rateB = getPurchaseRate(b);

      if (rateA !== rateB) {
        return rateB - rateA;
      }

      return b.pv - a.pv;
    })
    .slice(0, 5);
}

export function getImprovementArticles(
  articles: ArticleMetricSummary[],
): ImprovementArticle[] {
  return articles
    .map((article) => {
      const purchaseRate = getPurchaseRate(article);
      const priority: ImprovementArticle["priority"] =
        purchaseRate < 5 ? "高" : "中";
      const gapToTenPercent = Math.max(0, 10 - purchaseRate);

      return {
        ...article,
        priority,
        score: article.pv * gapToTenPercent,
      };
    })
    .filter((article) => article.pv >= 100 && getPurchaseRate(article) < 10)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      return b.pv - a.pv;
    })
    .slice(0, 5);
}
