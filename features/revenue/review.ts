import type { RevenueTaskType } from "@prisma/client";
import {
  formatTokyoDateInputValue,
  normalizeDateInputToTokyoDate,
} from "@/features/metrics/calculators";

export type RevenueReviewPhase = "MEASURING" | "REVIEW_READY";

export type RevenueReviewResult =
  | "POSITIVE_SIGNAL"
  | "NO_POSITIVE_SIGNAL"
  | "INSUFFICIENT_DATA"
  | null;

export type RevenueReviewNextAction = "CONTINUE" | "RETRY" | "OBSERVE";

export type RevenueReviewEvidence = {
  before: {
    pv: number;
    purchases: number;
    revenue: number;
    metricDays: number;
  };
  after: {
    pv: number;
    purchases: number;
    revenue: number;
    metricDays: number;
  };
  delta: {
    pv: number;
    purchases: number;
    revenue: number;
    revenueRate: number | null;
  };
};

export type RevenueReviewQueueItem = {
  taskId: string;
  taskTitle: string;
  taskType: RevenueTaskType;
  priority: number;
  articleId: string;
  articleTitle: string | null;
  completedAt: Date;
  createdAt: Date;
  daysSinceCompletion: number;
  beforePeriod: string;
  afterPeriod: string;
  phase: RevenueReviewPhase;
  result: RevenueReviewResult;
  nextAction: RevenueReviewNextAction;
  evidence: RevenueReviewEvidence;
};

export const MIN_METRIC_DAYS_PER_PERIOD = 3;
export const MIN_TOTAL_PV_FOR_REVIEW = 20;
export const REVENUE_REVIEW_WINDOW_DAYS = 90;
export const TODAY_REVIEW_READY_FROM_DAYS = 7;
export const TODAY_REVIEW_READY_TO_DAYS = 13;

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function addRevenueReviewDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(date.getUTCDate() + days);
  return nextDate;
}

export function getRevenueReviewCompletedDate(completedAt: Date) {
  return normalizeDateInputToTokyoDate(formatTokyoDateInputValue(completedAt));
}

export function getRevenueReviewPeriods(completedAt: Date) {
  const completedDate = getRevenueReviewCompletedDate(completedAt);

  if (!completedDate) {
    return null;
  }

  const beforeFrom = addRevenueReviewDays(completedDate, -7);
  const beforeExclusiveTo = completedDate;
  const afterFrom = completedDate;
  const afterExclusiveTo = addRevenueReviewDays(completedDate, 7);

  return {
    completedDate,
    beforeFrom,
    beforeExclusiveTo,
    afterFrom,
    afterExclusiveTo,
    beforePeriod: `${formatTokyoDateInputValue(beforeFrom)}〜${formatTokyoDateInputValue(
      addRevenueReviewDays(beforeExclusiveTo, -1),
    )}`,
    afterPeriod: `${formatTokyoDateInputValue(afterFrom)}〜${formatTokyoDateInputValue(
      addRevenueReviewDays(afterExclusiveTo, -1),
    )}`,
  };
}

export function getRevenueReviewDaysSinceCompletion({
  completedAt,
  today,
}: {
  completedAt: Date;
  today: Date;
}) {
  const completedDate = getRevenueReviewCompletedDate(completedAt);

  if (!completedDate) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((today.getTime() - completedDate.getTime()) / millisecondsPerDay),
  );
}

export function getRevenueReviewPhase(
  daysSinceCompletion: number,
): RevenueReviewPhase {
  return daysSinceCompletion < 7 ? "MEASURING" : "REVIEW_READY";
}

function emptyRevenueReviewPeriod(): RevenueReviewEvidence["before"] {
  return {
    pv: 0,
    purchases: 0,
    revenue: 0,
    metricDays: 0,
  };
}

export function buildRevenueReviewEvidence({
  beforeMetrics,
  afterMetrics,
}: {
  beforeMetrics: Array<{
    pv: number;
    purchases: number;
    revenue: number;
  }>;
  afterMetrics: Array<{
    pv: number;
    purchases: number;
    revenue: number;
  }>;
}): RevenueReviewEvidence {
  const before = beforeMetrics.reduce<RevenueReviewEvidence["before"]>(
    (total, metric): RevenueReviewEvidence["before"] => {
      return {
        pv: total.pv + metric.pv,
        purchases: total.purchases + metric.purchases,
        revenue: total.revenue + metric.revenue,
        metricDays: total.metricDays + 1,
      };
    },
    emptyRevenueReviewPeriod(),
  );
  const after = afterMetrics.reduce<RevenueReviewEvidence["after"]>(
    (total, metric): RevenueReviewEvidence["after"] => {
      return {
        pv: total.pv + metric.pv,
        purchases: total.purchases + metric.purchases,
        revenue: total.revenue + metric.revenue,
        metricDays: total.metricDays + 1,
      };
    },
    emptyRevenueReviewPeriod(),
  );
  const revenueDelta = after.revenue - before.revenue;

  return {
    before,
    after,
    delta: {
      pv: after.pv - before.pv,
      purchases: after.purchases - before.purchases,
      revenue: revenueDelta,
      revenueRate: before.revenue === 0 ? null : (revenueDelta / before.revenue) * 100,
    },
  };
}

export function isRevenueReviewInsufficientData(evidence: RevenueReviewEvidence) {
  if (
    evidence.before.metricDays < MIN_METRIC_DAYS_PER_PERIOD ||
    evidence.after.metricDays < MIN_METRIC_DAYS_PER_PERIOD
  ) {
    return true;
  }

  return (
    evidence.before.pv + evidence.after.pv < MIN_TOTAL_PV_FOR_REVIEW &&
    evidence.before.purchases + evidence.after.purchases === 0 &&
    evidence.before.revenue + evidence.after.revenue === 0
  );
}

export function getRevenueReviewResult({
  phase,
  evidence,
}: {
  phase: RevenueReviewPhase;
  evidence: RevenueReviewEvidence;
}): RevenueReviewResult {
  if (phase === "MEASURING") {
    return null;
  }

  if (isRevenueReviewInsufficientData(evidence)) {
    return "INSUFFICIENT_DATA";
  }

  return evidence.after.revenue > evidence.before.revenue
    ? "POSITIVE_SIGNAL"
    : "NO_POSITIVE_SIGNAL";
}

export function getRevenueReviewNextAction({
  phase,
  result,
}: {
  phase: RevenueReviewPhase;
  result: RevenueReviewResult;
}): RevenueReviewNextAction {
  if (phase === "MEASURING" || result === "INSUFFICIENT_DATA") {
    return "OBSERVE";
  }

  if (result === "POSITIVE_SIGNAL") {
    return "CONTINUE";
  }

  return "RETRY";
}

const reviewPhaseRank = {
  REVIEW_READY: 0,
  MEASURING: 1,
} satisfies Record<RevenueReviewPhase, number>;

export function compareRevenueReviewQueueItems(
  left: RevenueReviewQueueItem,
  right: RevenueReviewQueueItem,
) {
  const phaseDiff = reviewPhaseRank[left.phase] - reviewPhaseRank[right.phase];

  if (phaseDiff !== 0) {
    return phaseDiff;
  }

  return compareTodayRevenueReviewQueueItems(left, right);
}

export function compareTodayRevenueReviewQueueItems(
  left: RevenueReviewQueueItem,
  right: RevenueReviewQueueItem,
) {
  const priorityDiff = right.priority - left.priority;

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const completedAtDiff = right.completedAt.getTime() - left.completedAt.getTime();

  if (completedAtDiff !== 0) {
    return completedAtDiff;
  }

  const createdAtDiff = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.taskId.localeCompare(right.taskId);
}
