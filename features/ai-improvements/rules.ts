import { calculatePurchaseRate } from "@/app/articles/utils";

export type AiImprovementPriority = "high" | "medium" | "low";

export type AiImprovementArticle = {
  id: string;
  title: string;
  price: number;
  pv: number;
  purchases: number;
  updatedAt: Date;
};

export type RuleBasedImprovement = {
  articleId: string;
  title: string;
  priority: AiImprovementPriority;
  priorityLabel: string;
  score: number;
  pv: number;
  purchases: number;
  conversionRate: number;
  price: number;
  updatedAt: Date;
  recentlyUpdated: boolean;
  improvementReason: string;
  titleIdeas: string[];
  freePreviewSuggestion: string;
  ctaSuggestion: string;
  priceSuggestion: string;
  relatedArticleSuggestion: string;
  rewritePriority: string;
  expectedEffect: string;
};

const recentUpdateDays = 7;
const staleDays = 21;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function getDaysSince(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / millisecondsPerDay));
}

function getPriority(score: number): AiImprovementPriority {
  if (score >= 70) {
    return "high";
  }

  if (score >= 40) {
    return "medium";
  }

  return "low";
}

function getPriorityLabel(priority: AiImprovementPriority) {
  if (priority === "high") {
    return "高";
  }

  if (priority === "medium") {
    return "中";
  }

  return "低";
}

function getArticleTokens(title: string) {
  return new Set(
    title
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[【】()[\]（）「」『』、。，．・:：|｜!！?？]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2),
  );
}

function findRelatedArticles(
  article: AiImprovementArticle,
  articles: AiImprovementArticle[],
) {
  const tokens = getArticleTokens(article.title);

  return articles
    .filter((candidate) => candidate.id !== article.id)
    .map((candidate) => {
      const candidateTokens = getArticleTokens(candidate.title);
      let overlap = 0;

      tokens.forEach((token) => {
        if (candidateTokens.has(token)) {
          overlap += 1;
        }
      });

      return {
        article: candidate,
        overlap,
        conversionRate: calculatePurchaseRate(candidate.purchases, candidate.pv),
      };
    })
    .filter((candidate) => candidate.overlap > 0)
    .sort((a, b) => {
      if (a.overlap !== b.overlap) {
        return b.overlap - a.overlap;
      }

      return b.conversionRate - a.conversionRate;
    })
    .slice(0, 2)
    .map((candidate) => candidate.article.title);
}

function buildScore({
  article,
  conversionRate,
  daysSinceUpdate,
}: {
  article: AiImprovementArticle;
  conversionRate: number;
  daysSinceUpdate: number;
}) {
  const pvScore = Math.min(35, article.pv / 20);
  const conversionGapScore =
    article.pv >= 100 ? Math.max(0, 10 - conversionRate) * 4 : 0;
  const noPurchaseScore = article.pv >= 100 && article.purchases === 0 ? 18 : 0;
  const staleScore = daysSinceUpdate >= staleDays ? 14 : daysSinceUpdate >= 10 ? 8 : 0;
  const highPriceFrictionScore =
    article.price >= 1000 && article.pv >= 100 && conversionRate < 8 ? 8 : 0;
  const recentlyUpdatedPenalty = daysSinceUpdate <= recentUpdateDays ? 8 : 0;

  return Math.max(
    0,
    Math.round(
      pvScore +
        conversionGapScore +
        noPurchaseScore +
        staleScore +
        highPriceFrictionScore -
        recentlyUpdatedPenalty,
    ),
  );
}

function buildReason({
  article,
  conversionRate,
  daysSinceUpdate,
}: {
  article: AiImprovementArticle;
  conversionRate: number;
  daysSinceUpdate: number;
}) {
  const reasons: string[] = [];

  if (article.pv >= 100 && conversionRate < 10) {
    reasons.push(
      `PVは${article.pv.toLocaleString("ja-JP")}ありますが、購入率が${conversionRate.toFixed(
        1,
      )}%で改善余地があります`,
    );
  }

  if (article.purchases === 0 && article.pv >= 100) {
    reasons.push("購入数が0のため、無料部分とCTAの見直し効果が出やすい状態です");
  }

  if (daysSinceUpdate >= staleDays) {
    reasons.push(`${daysSinceUpdate}日更新されておらず、情報鮮度の改善余地があります`);
  }

  if (article.price >= 1000 && conversionRate < 8) {
    reasons.push("価格に対して購入前の納得材料が不足している可能性があります");
  }

  return reasons.length > 0
    ? reasons.join("。") + "。"
    : "大きな問題はありませんが、タイトルと導線を整えることで追加改善が狙えます。";
}

function buildTitleIdeas(title: string) {
  const base = title.replace(/【.*?】/g, "").trim() || title;

  return [
    `【実例つき】${base}で失敗しないための具体手順`,
    `${base}を最短で成果につなげるチェックリスト`,
    `初心者でも迷わない${base}の始め方と注意点`,
  ];
}

function buildPriceSuggestion(article: AiImprovementArticle, conversionRate: number) {
  if (article.pv >= 100 && conversionRate < 5 && article.price >= 1000) {
    return "値下げより先に、無料部分へ具体的な中身・購入後に得られる成果・目次を追加してください。改善後も購入率が低い場合は期間限定価格をテストします。";
  }

  if (conversionRate >= 12 && article.purchases >= 5) {
    return "購入率が高いため、価格は維持しつつ、関連商品の導線追加を優先します。値上げは購入数の推移を見て小さくテストします。";
  }

  return "現時点では価格変更より、無料部分とCTAの改善を優先します。";
}

export function generateRuleBasedImprovements(
  articles: AiImprovementArticle[],
  now = new Date(),
) {
  return articles
    .map((article) => {
      const conversionRate = calculatePurchaseRate(article.purchases, article.pv);
      const daysSinceUpdate = getDaysSince(article.updatedAt, now);
      const recentlyUpdated = daysSinceUpdate <= recentUpdateDays;
      const score = buildScore({
        article,
        conversionRate,
        daysSinceUpdate,
      });
      const priority = getPriority(score);
      const relatedTitles = findRelatedArticles(article, articles);

      return {
        articleId: article.id,
        title: article.title,
        priority,
        priorityLabel: getPriorityLabel(priority),
        score,
        pv: article.pv,
        purchases: article.purchases,
        conversionRate,
        price: article.price,
        updatedAt: article.updatedAt,
        recentlyUpdated,
        improvementReason: buildReason({
          article,
          conversionRate,
          daysSinceUpdate,
        }),
        titleIdeas: buildTitleIdeas(article.title),
        freePreviewSuggestion:
          "冒頭に「誰向けか」「この記事で解決できる悩み」「購入後に得られるもの」を3点で明記し、本文の一部を具体例として見せます。",
        ctaSuggestion:
          "無料部分の最後に、購入後の到達点を1文で示し、「今すぐ本文でテンプレートを見る」のように行動が明確なCTAへ変更します。",
        priceSuggestion: buildPriceSuggestion(article, conversionRate),
        relatedArticleSuggestion:
          relatedTitles.length > 0
            ? `本文末と無料部分に「次に読む記事」として「${relatedTitles.join("」「")}」への導線を追加します。`
            : "同じテーマの記事が少ないため、本文末に関連記事枠を作り、今後追加する関連記事への導線を置ける構成にします。",
        rewritePriority:
          priority === "high"
            ? "今日対応"
            : priority === "medium"
              ? "今週対応"
              : "余力がある日に微修正",
        expectedEffect:
          priority === "high"
            ? "PVを活かして購入率を底上げし、売上改善に直結する可能性があります。"
            : priority === "medium"
              ? "無料部分とCTAの摩擦を下げ、購入判断までの離脱を減らせます。"
              : "小さな改善で記事全体の回遊と信頼感を底上げできます。",
      } satisfies RuleBasedImprovement;
    })
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      if (a.pv !== b.pv) {
        return b.pv - a.pv;
      }

      return a.conversionRate - b.conversionRate;
    });
}
