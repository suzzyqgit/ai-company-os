import { formatTokyoDateInputValue, normalizeDateInputToTokyoDate } from "@/features/metrics/calculators";
import type { ArticleContentGap } from "@/features/content-gap/calculators";
import type { RuleBasedImprovement } from "@/features/ai-improvements/rules";
import type { FreeArticleEvaluation } from "@/features/free-articles/evaluation";
import type { FreeArticleImprovementSuggestion } from "@/features/free-articles/improvements";
import type { FreeArticlePipelineStatus } from "@/features/free-articles/status";
import type {
  RevenueReviewRecommendationType,
  RevenueReviewRecommendation,
} from "@/features/revenue/recommendations";
import type {
  RevenueReviewNextAction,
  RevenueReviewResult,
} from "@/features/revenue/review";

export type TodayChecklistItem = {
  key: TodayTaskKey;
  label: string;
  href: string;
  completed: boolean;
};

export type TodayPrePublishFreeArticle = {
  id: string;
  title: string;
  status: FreeArticlePipelineStatus;
  updatedAt: Date;
  href: string;
};

export type TodayFreeArticleImprovementCandidate = {
  id: string;
  title: string;
  publishedPv: number;
  referralCount: number;
  purchaseCount: number;
  improvementCount: number;
  evaluation: FreeArticleEvaluation;
  improvementSuggestions: FreeArticleImprovementSuggestion[];
  href: string;
};

export type TodayKpis = {
  todayRevenue: number;
  todayPv: number;
  todayPurchases: number;
  weekRevenue: number;
  weekPurchases: number;
  remainingPurchasesToGoal: number;
};

export type TodayPrimaryTask = {
  title: string;
  reason: string;
  expectedEffect: string;
  href: string;
  buttonLabel: string;
};

export type TodayFreeArticlePlan = {
  destinationArticleId: string;
  destinationArticleTitle: string;
  missingCategory: string;
  recommendedTheme: string;
  expectedImpact: number | null;
  pipelineStatus: FreeArticlePipelineStatus | null;
  pipelineImprovementCount: number | null;
  actionLabel: string;
  href: string;
};

export type TodayImprovementArticle = {
  articleId: string;
  title: string;
  pv: number;
  conversionRate: number;
  price: number;
  reason: string;
};

export type TodayRecentUpdate = {
  id: string;
  type: "OCR" | "CSV" | "無料記事" | "AI改善" | "公開記事同期";
  title: string;
  at: Date;
  href: string;
};

export type TodayRevenueActionQueueItem = {
  id: string;
  title: string;
  status: "TODO" | "DOING";
  priority: number;
  createdAt: Date;
  article: {
    id: string;
    title: string;
  } | null;
};

export type TodayRevenueReviewQueueItem = {
  taskId: string;
  taskTitle: string;
  articleId: string;
  articleTitle: string | null;
  completedAt: Date;
  priority: number;
  revenueDelta: number;
  result: RevenueReviewResult;
  nextAction: RevenueReviewNextAction;
};

export type TodayRevenueReviewRecommendationItem = {
  taskId: string;
  taskTitle: string;
  articleId: string;
  articleTitle: string | null;
  recommendationType: RevenueReviewRecommendationType;
  priority: number;
  reason: string;
  recommendedAction: string;
  revenueDelta: number;
  pvDelta: number;
  purchasesDelta: number;
  completedAt: Date;
};

export function toTodayRevenueReviewRecommendationItem(
  recommendation: RevenueReviewRecommendation,
): TodayRevenueReviewRecommendationItem {
  return {
    taskId: recommendation.taskId,
    taskTitle: recommendation.taskTitle,
    articleId: recommendation.articleId,
    articleTitle: recommendation.articleTitle,
    recommendationType: recommendation.recommendationType,
    priority: recommendation.priority,
    reason: recommendation.reason,
    recommendedAction: recommendation.recommendedAction,
    revenueDelta: recommendation.revenueDelta,
    pvDelta: recommendation.pvDelta,
    purchasesDelta: recommendation.purchasesDelta,
    completedAt: recommendation.completedAt,
  };
}

export const todayPurchaseGoal = 5;
export const todayChecklistDefinitions = [
  { key: "import-ocr", label: "OCRを取り込む", href: "/imports/note-access" },
  { key: "review-ai", label: "AI改善を確認する", href: "/ai-improvements" },
  { key: "generate-free-article", label: "今日の記事を生成する", href: "/free-article-generator" },
  { key: "complete-publish-checklist", label: "公開チェックリストを確認する", href: "/free-articles" },
  { key: "review-cta", label: "CTAを見直す", href: "/content-gap" },
  { key: "update-dashboard", label: "Dashboardを更新する", href: "/" },
] as const;
export type TodayTaskKey = (typeof todayChecklistDefinitions)[number]["key"];
const todayTaskKeys = new Set<string>(
  todayChecklistDefinitions.map((definition) => definition.key),
);
const priorityRank = {
  高: 3,
  中: 2,
  低: 1,
} satisfies Record<ArticleContentGap["priority"], number>;

export function getTodayDateInput() {
  return formatTokyoDateInputValue(new Date());
}

export function getTodayTokyoDate() {
  const today = normalizeDateInputToTokyoDate(getTodayDateInput());

  if (!today) {
    throw new Error("Failed to resolve today's Tokyo date.");
  }

  return today;
}

export function getWeekStartTokyoDate(today: Date) {
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - 6);
  return weekStart;
}

export function buildChecklistItems(completedKeys: Set<string>): TodayChecklistItem[] {
  return todayChecklistDefinitions.map((item) => ({
    ...item,
    completed: completedKeys.has(item.key),
  }));
}

export function isTodayTaskKey(value: string): value is TodayTaskKey {
  return value.length <= 64 && todayTaskKeys.has(value);
}

export function pickTodayImprovementArticle(
  improvements: RuleBasedImprovement[],
): TodayImprovementArticle | null {
  const improvement = improvements[0];

  if (!improvement) {
    return null;
  }

  return {
    articleId: improvement.articleId,
    title: improvement.title,
    pv: improvement.pv,
    conversionRate: improvement.conversionRate,
    price: improvement.price,
    reason: improvement.improvementReason,
  };
}

export function pickTodayFreeArticlePlan(
  gaps: ArticleContentGap[],
): TodayFreeArticlePlan | null {
  const gap = [...gaps].sort(compareContentGapsForToday)[0];

  if (!gap) {
    return null;
  }

  const missingCategory = gap.missingCategories[0] ?? "認知";
  const recommendedTheme =
    gap.recommendedThemes[0] ?? `${gap.title}へ進む前に知りたい${missingCategory}`;
  const params = new URLSearchParams({
    articleId: gap.articleId,
    category: missingCategory,
  });

  return {
    destinationArticleId: gap.articleId,
    destinationArticleTitle: gap.title,
    missingCategory,
    recommendedTheme,
    expectedImpact: gap.expectedImpact > 0 ? gap.expectedImpact : null,
    pipelineStatus: null,
    pipelineImprovementCount: null,
    actionLabel: "記事生成",
    href: `/free-article-generator?${params.toString()}`,
  };
}

export function applyFreeArticlePipelineStatus(
  plan: TodayFreeArticlePlan,
  status: FreeArticlePipelineStatus | null,
  improvementCount: number | null = null,
): TodayFreeArticlePlan {
  if (!status) {
    return plan;
  }

  if (status === "PUBLISHED") {
    return {
      ...plan,
      pipelineStatus: status,
      pipelineImprovementCount: improvementCount,
      actionLabel: improvementCount === 0 ? "改善へ送る" : "改善履歴を見る",
      href: "/free-articles",
    };
  }

  if (status === "READY") {
    return {
      ...plan,
      pipelineStatus: status,
      pipelineImprovementCount: improvementCount,
      actionLabel: "公開してください",
      href: "/free-articles",
    };
  }

  if (status === "DRAFT" || status === "REVIEW") {
    return {
      ...plan,
      pipelineStatus: status,
      pipelineImprovementCount: improvementCount,
      actionLabel: "編集へ",
      href: "/free-articles",
    };
  }

  if (status === "IMPROVING") {
    return {
      ...plan,
      pipelineStatus: status,
      pipelineImprovementCount: improvementCount,
      actionLabel: "改善状況を見る",
      href: "/free-articles",
    };
  }

  return plan;
}

function compareContentGapsForToday(
  left: ArticleContentGap,
  right: ArticleContentGap,
) {
  const expectedImpactDiff = right.expectedImpact - left.expectedImpact;

  if (expectedImpactDiff !== 0) {
    return expectedImpactDiff;
  }

  const priorityDiff = priorityRank[right.priority] - priorityRank[left.priority];

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const missingCategoryDiff =
    right.missingCategories.length - left.missingCategories.length;

  if (missingCategoryDiff !== 0) {
    return missingCategoryDiff;
  }

  const updatedAtDiff = left.updatedAt.getTime() - right.updatedAt.getTime();

  if (updatedAtDiff !== 0) {
    return updatedAtDiff;
  }

  return left.articleId.localeCompare(right.articleId);
}

export function buildPrimaryTask({
  freeArticlePlan,
}: {
  freeArticlePlan: TodayFreeArticlePlan | null;
}): TodayPrimaryTask {
  if (!freeArticlePlan) {
    return {
      title: "AI改善を確認",
      reason: "今日作る無料記事の候補がまだ十分にありません。",
      expectedEffect: "改善対象の整理",
      href: "/ai-improvements",
      buttonLabel: "確認する",
    };
  }

  const expectedEffect =
    freeArticlePlan.expectedImpact === null
      ? "算出データ不足"
      : `+¥${freeArticlePlan.expectedImpact.toLocaleString("ja-JP")}`;

  return {
    title: "無料記事を1本作成",
    reason: `${freeArticlePlan.destinationArticleTitle} の ${freeArticlePlan.missingCategory} 導線が不足しています。`,
    expectedEffect,
    href: freeArticlePlan.href,
    buttonLabel: freeArticlePlan.actionLabel,
  };
}
