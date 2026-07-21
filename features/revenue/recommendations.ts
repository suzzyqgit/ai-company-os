import type {
  RevenueReviewQueueItem,
  RevenueReviewResult,
} from "./review";

export type RevenueReviewRecommendationType =
  | "CONTINUE_WINNER"
  | "RETRY_CTA"
  | "RETRY_OFFER"
  | "RETRY_TRAFFIC"
  | "COLLECT_MORE_DATA"
  | "NO_ACTION";

export type RevenueReviewRecommendation = {
  taskId: string;
  taskTitle: string;
  articleId: string;
  articleTitle: string | null;
  recommendationType: RevenueReviewRecommendationType;
  priority: number;
  reason: string;
  recommendedAction: string;
  sourceResult: RevenueReviewResult;
  revenueDelta: number;
  pvDelta: number;
  purchasesDelta: number;
  completedAt: Date;
};

const recommendationUrgencyRank = {
  RETRY_CTA: 0,
  RETRY_OFFER: 1,
  RETRY_TRAFFIC: 2,
  CONTINUE_WINNER: 3,
  COLLECT_MORE_DATA: 4,
  NO_ACTION: 5,
} satisfies Record<RevenueReviewRecommendationType, number>;

export function buildRevenueReviewRecommendation(
  item: RevenueReviewQueueItem,
): RevenueReviewRecommendation | null {
  if (item.phase === "MEASURING" || item.result === null) {
    return null;
  }

  const baseRecommendation = {
    taskId: item.taskId,
    taskTitle: item.taskTitle,
    articleId: item.articleId,
    articleTitle: item.articleTitle,
    priority: item.priority,
    sourceResult: item.result,
    revenueDelta: item.evidence.delta.revenue,
    pvDelta: item.evidence.delta.pv,
    purchasesDelta: item.evidence.delta.purchases,
    completedAt: item.completedAt,
  };

  if (item.result === "POSITIVE_SIGNAL") {
    return {
      ...baseRecommendation,
      recommendationType: "CONTINUE_WINNER",
      reason: "完了後7日間の売上が完了前7日間を上回っています。",
      recommendedAction:
        "成果が出た施策を継続し、他の記事への横展開を検討する。",
    };
  }

  if (item.result === "INSUFFICIENT_DATA") {
    return {
      ...baseRecommendation,
      recommendationType: "COLLECT_MORE_DATA",
      reason: "判定に必要な計測日数、PV、購入数、売上データが不足しています。",
      recommendedAction:
        "追加データが蓄積するまで変更を重ねず観察する。",
    };
  }

  if (item.evidence.delta.pv < 0) {
    return {
      ...baseRecommendation,
      recommendationType: "RETRY_TRAFFIC",
      reason: "売上改善が確認できず、施策後のPVも減少しています。",
      recommendedAction:
        "タイトル、無料記事からの導線、記事間リンク、流入チャネルを見直す。",
    };
  }

  if (item.evidence.delta.purchases < 0) {
    return {
      ...baseRecommendation,
      recommendationType: "RETRY_CTA",
      reason: "流入は維持されていますが、購入数が減少しています。",
      recommendedAction: "CTA、商品訴求、購入理由、購入導線を見直す。",
    };
  }

  return {
    ...baseRecommendation,
    recommendationType: "RETRY_OFFER",
    reason: "流入と購入数は維持されていますが、売上改善が確認できません。",
    recommendedAction:
      "価格、商品構成、オファー内容、関連商品の導線を見直す。",
  };
}

export function compareRevenueReviewRecommendations(
  left: RevenueReviewRecommendation,
  right: RevenueReviewRecommendation,
) {
  const urgencyDiff =
    recommendationUrgencyRank[left.recommendationType] -
    recommendationUrgencyRank[right.recommendationType];

  if (urgencyDiff !== 0) {
    return urgencyDiff;
  }

  const priorityDiff = right.priority - left.priority;

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const revenueDeltaDiff = left.revenueDelta - right.revenueDelta;

  if (revenueDeltaDiff !== 0) {
    return revenueDeltaDiff;
  }

  const completedAtDiff = right.completedAt.getTime() - left.completedAt.getTime();

  if (completedAtDiff !== 0) {
    return completedAtDiff;
  }

  return left.taskId.localeCompare(right.taskId);
}

export function deduplicateRevenueReviewRecommendations(
  recommendations: RevenueReviewRecommendation[],
) {
  const uniqueRecommendations = new Map<string, RevenueReviewRecommendation>();

  for (const recommendation of [...recommendations].sort(
    compareRevenueReviewRecommendations,
  )) {
    const key = `${recommendation.articleId}:${recommendation.recommendationType}`;

    if (!uniqueRecommendations.has(key)) {
      uniqueRecommendations.set(key, recommendation);
    }
  }

  return [...uniqueRecommendations.values()];
}
