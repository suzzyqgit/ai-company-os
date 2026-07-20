import type {
  FreeArticleEvaluation,
  FreeArticleEvaluationInput,
  FreeArticleImprovementPriority,
} from "./evaluation";

export type FreeArticleImprovementCategory =
  | "タイトル改善"
  | "導入改善"
  | "見出し改善"
  | "CTA改善"
  | "公開後改善";

export type FreeArticleImprovementSuggestion = {
  category: FreeArticleImprovementCategory;
  reason: string;
  priority: FreeArticleImprovementPriority;
  actions: string[];
};

export type FreeArticleImprovementInput = FreeArticleEvaluationInput & {
  evaluation: FreeArticleEvaluation;
};

function getDaysSince(date: Date | null, now: Date) {
  if (!date) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function getSuggestionPriority({
  category,
  evaluation,
}: {
  category: FreeArticleImprovementCategory;
  evaluation: FreeArticleEvaluation;
}): FreeArticleImprovementPriority {
  if (evaluation.priority === "高") {
    return "高";
  }

  if (category === "CTA改善" && evaluation.grade === "B") {
    return "中";
  }

  return evaluation.priority;
}

function uniqueSuggestions(
  suggestions: FreeArticleImprovementSuggestion[],
): FreeArticleImprovementSuggestion[] {
  const seenCategories = new Set<FreeArticleImprovementCategory>();

  return suggestions.filter((suggestion) => {
    if (seenCategories.has(suggestion.category)) {
      return false;
    }

    seenCategories.add(suggestion.category);
    return true;
  });
}

export function generateFreeArticleImprovementSuggestions(
  input: FreeArticleImprovementInput,
  now = new Date(),
): FreeArticleImprovementSuggestion[] {
  const suggestions: FreeArticleImprovementSuggestion[] = [];

  if (
    input.evaluation.phase === "collecting" ||
    input.evaluation.phase === "unavailable"
  ) {
    return [];
  }

  const daysSincePublished = getDaysSince(input.publishedAt, now);
  const daysSinceImproved =
    input.improvementCount > 0 ? getDaysSince(input.updatedAt, now) : null;

  if (input.publishedPv <= 100) {
    suggestions.push({
      category: "タイトル改善",
      reason: input.publishedPv <= 50 ? "PVが50以下" : "PVが100以下",
      priority: getSuggestionPriority({
        category: "タイトル改善",
        evaluation: input.evaluation,
      }),
      actions: [
        "タイトル候補を10案以上出し直す",
        "数字を入れてクリック理由を明確にする",
        "比較・失敗回避の切り口を試す",
      ],
    });
  }

  if (input.referralCount <= 3) {
    suggestions.push({
      category: "CTA改善",
      reason: input.referralCount === 0 ? "送客が0" : "送客が少ない",
      priority: getSuggestionPriority({
        category: "CTA改善",
        evaluation: input.evaluation,
      }),
      actions: [
        "CTA位置を少し上げる",
        "CTA文章を短くする",
        "CTA先で得られる価値を先に伝える",
      ],
    });
  }

  if (input.purchaseCount === 0) {
    suggestions.push({
      category: "導入改善",
      reason: "購入につながっていない",
      priority: getSuggestionPriority({
        category: "導入改善",
        evaluation: input.evaluation,
      }),
      actions: [
        "導入を短くして悩みを先に置く",
        "ベネフィットを最初の数行で見せる",
        "無料部分の価値と続きの不足感を分ける",
      ],
    });
  }

  if (input.evaluation.score < 70) {
    suggestions.push({
      category: "見出し改善",
      reason: "総合評価がB未満",
      priority: getSuggestionPriority({
        category: "見出し改善",
        evaluation: input.evaluation,
      }),
      actions: [
        "見出しごとの役割を分ける",
        "失敗例、比較、チェックリストを混ぜる",
        "各見出しの最後に次を読みたくなる接続を入れる",
      ],
    });
  }

  if (
    input.improvementCount === 0 ||
    daysSincePublished === null ||
    daysSincePublished >= 7 ||
    (daysSinceImproved !== null && daysSinceImproved >= 14)
  ) {
    suggestions.push({
      category: "公開後改善",
      reason:
        input.improvementCount === 0
          ? "改善履歴なし"
          : daysSincePublished === null
            ? "公開日未設定"
            : daysSincePublished >= 7
              ? "公開7日経過"
              : "最終改善から14日以上",
      priority: getSuggestionPriority({
        category: "公開後改善",
        evaluation: input.evaluation,
      }),
      actions: [
        "改善へ送って1箇所だけ直す",
        "公開後のPVと送客数を見て再投稿を検討する",
        "タイトルまたはCTAのどちらか一方から変更する",
      ],
    });
  }

  return uniqueSuggestions(suggestions).slice(
    0,
    input.evaluation.phase === "reference" ? 1 : 3,
  );
}
