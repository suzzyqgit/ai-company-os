import type {
  RevenueReviewRecommendation,
  RevenueReviewRecommendationType,
} from "@/features/revenue/recommendations";

export type ImprovementIdea = {
  id: string;
  sourceRecommendationType: RevenueReviewRecommendationType;
  taskId: string;
  taskTitle: string;
  articleId: string;
  articleTitle: string | null;
  title: string;
  priority: number;
  reason: string;
  recommendedAction: string;
  revenueDelta: number;
  pvDelta: number;
  purchasesDelta: number;
  completedAt: Date;
};

const improvementIdeaTitles = {
  CONTINUE_WINNER: "成果施策を横展開する",
  RETRY_CTA: "CTAと購入導線を見直す",
  RETRY_OFFER: "価格とオファーを見直す",
  RETRY_TRAFFIC: "流入導線を見直す",
  COLLECT_MORE_DATA: "追加データを計測する",
  NO_ACTION: "追加対応なし",
} satisfies Record<RevenueReviewRecommendationType, string>;

function assertNever(value: never): never {
  throw new Error(`Unsupported recommendation type: ${String(value)}`);
}

function getImprovementIdeaTitle(
  recommendationType: RevenueReviewRecommendationType,
) {
  switch (recommendationType) {
    case "CONTINUE_WINNER":
    case "RETRY_CTA":
    case "RETRY_OFFER":
    case "RETRY_TRAFFIC":
    case "COLLECT_MORE_DATA":
    case "NO_ACTION":
      return improvementIdeaTitles[recommendationType];
    default:
      return assertNever(recommendationType);
  }
}

export function buildImprovementIdea(
  recommendation: RevenueReviewRecommendation,
): ImprovementIdea {
  return {
    id: `improvement-idea:${recommendation.articleId}:${recommendation.recommendationType}:${recommendation.taskId}`,
    sourceRecommendationType: recommendation.recommendationType,
    taskId: recommendation.taskId,
    taskTitle: recommendation.taskTitle,
    articleId: recommendation.articleId,
    articleTitle: recommendation.articleTitle,
    title: getImprovementIdeaTitle(recommendation.recommendationType),
    priority: recommendation.priority,
    reason: recommendation.reason,
    recommendedAction: recommendation.recommendedAction,
    revenueDelta: recommendation.revenueDelta,
    pvDelta: recommendation.pvDelta,
    purchasesDelta: recommendation.purchasesDelta,
    completedAt: recommendation.completedAt,
  };
}

export function buildImprovementIdeas(
  recommendations: RevenueReviewRecommendation[],
) {
  return recommendations.map(buildImprovementIdea);
}
