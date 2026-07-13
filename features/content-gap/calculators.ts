import { contentGapCategories } from "./categories";

export type ContentGapSourceArticle = {
  id: string;
  title: string;
  note: string;
  price: number;
  pv: number;
  purchases: number;
  updatedAt: Date;
  freeArticleIdeas: Array<{
    title: string;
    theme: string;
    searchIntent: string;
    funnelRole: string;
    status: string;
  }>;
  freeArticleDrafts: Array<{
    title: string;
    theme: string;
    status: string;
  }>;
  noteSaleTransactions: Array<{
    amount: number;
  }>;
  accessImportItems: Array<{
    extractedPv: number;
    nextPv: number | null;
  }>;
  aiAnalysisRuns: Array<{
    outputText: string | null;
    outputJson: string | null;
  }>;
};

export type ContentGapPublishedFreeArticle = {
  destinationArticleId?: string;
  title: string;
  note: string;
  pv: number;
  updatedAt: Date;
};

export type CategoryGap = {
  category: string;
  status: "不足" | "十分" | "強い";
  score: number;
  priority: "高" | "中" | "低";
  ideaCount: number;
  draftCount: number;
  publishedCount: number;
  stars: string;
  recommendation: string;
  expectedImpact: number;
};

export type ArticleContentGap = {
  articleId: string;
  title: string;
  price: number;
  pv: number;
  purchases: number;
  updatedAt: Date;
  conversionRate: number;
  freeArticleCount: number;
  missingCategories: string[];
  recommendedThemes: string[];
  priority: "高" | "中" | "低";
  expectedImpact: number;
  expectedEffect: string;
  categories: CategoryGap[];
  aiImprovementHint: string;
};

function calculateConversionRate(purchases: number, pv: number) {
  if (pv === 0) {
    return 0;
  }

  return (purchases / pv) * 100;
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function includesAnyKeyword(text: string, keywords: string[]) {
  const normalizedText = normalize(text);
  return keywords.some((keyword) => normalizedText.includes(normalize(keyword)));
}

function matchesArticleContext(
  article: ContentGapSourceArticle,
  freeArticle: ContentGapPublishedFreeArticle,
) {
  if (freeArticle.destinationArticleId) {
    return freeArticle.destinationArticleId === article.id;
  }

  const articleKeywords = normalize(`${article.title} ${article.note}`)
    .split(/[、。,.・|｜/／\s]/)
    .filter((keyword) => keyword.length >= 3)
    .slice(0, 5);
  const text = normalize(`${freeArticle.title} ${freeArticle.note}`);

  return articleKeywords.some((keyword) => text.includes(keyword));
}

function getStars(score: number) {
  const filled = Math.min(5, Math.max(0, Math.round(score / 20)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

function getStatus(score: number): CategoryGap["status"] {
  if (score >= 70) {
    return "強い";
  }

  if (score >= 40) {
    return "十分";
  }

  return "不足";
}

function getPriority(score: number, article: ContentGapSourceArticle): CategoryGap["priority"] {
  const conversionRate = calculateConversionRate(article.purchases, article.pv);

  if (score < 35 && (article.pv >= 100 || conversionRate < 8)) {
    return "高";
  }

  if (score < 55) {
    return "中";
  }

  return "低";
}

function calculateExpectedImpact({
  article,
  category,
  score,
}: {
  article: ContentGapSourceArticle;
  category: string;
  score: number;
}) {
  const conversionRate = calculateConversionRate(article.purchases, article.pv);
  const gapMultiplier = Math.max(0.08, (100 - score) / 100);
  const roleMultiplier = category === "CTA記事" || category === "購入前教育" ? 1.4 : 1;
  const conversionLift = conversionRate < 5 ? 0.008 : conversionRate < 10 ? 0.005 : 0.003;
  const estimatedAdditionalPurchases = article.pv * conversionLift * gapMultiplier * roleMultiplier;

  return Math.round(estimatedAdditionalPurchases * article.price);
}

function buildRecommendation(category: string, articleTitle: string) {
  if (category === "比較") {
    return `${articleTitle}を買う前の比較記事を2本追加し、判断材料から送客する`;
  }

  if (category === "FAQ") {
    return `${articleTitle}の購入前不安をFAQ形式で解消する`;
  }

  if (category === "CTA記事") {
    return `${articleTitle}へ自然に進むCTA記事を追加する`;
  }

  return `${articleTitle}につながる${category}記事を追加する`;
}

function buildRecommendedTheme(category: string, articleTitle: string) {
  if (category === "比較") {
    return `${articleTitle}を買う前に比較したい判断基準`;
  }

  if (category === "失敗例") {
    return `${articleTitle}で遠回りしないための失敗例`;
  }

  if (category === "FAQ") {
    return `${articleTitle}の購入前によくある不安と答え`;
  }

  return `${articleTitle}へ進む前に知りたい${category}`;
}

export function analyzeContentGaps({
  paidArticles,
  publishedFreeArticles,
}: {
  paidArticles: ContentGapSourceArticle[];
  publishedFreeArticles: ContentGapPublishedFreeArticle[];
}) {
  return paidArticles.map((article) => {
    const conversionRate = calculateConversionRate(article.purchases, article.pv);
    const categories = contentGapCategories.map((categoryDefinition) => {
      const ideaCount = article.freeArticleIdeas.filter((idea) => {
        const text = `${idea.title} ${idea.theme}`;
        return (
          categoryDefinition.searchIntents.includes(idea.searchIntent) ||
          categoryDefinition.funnelRoles.includes(idea.funnelRole) ||
          includesAnyKeyword(text, categoryDefinition.keywords)
        );
      }).length;
      const draftCount = article.freeArticleDrafts.filter(
        (draft) =>
          !["ARCHIVED", "PUBLISHED"].includes(draft.status.toUpperCase()) &&
          includesAnyKeyword(`${draft.title} ${draft.theme}`, categoryDefinition.keywords),
      ).length;
      const publishedCount = publishedFreeArticles.filter(
        (freeArticle) =>
          matchesArticleContext(article, freeArticle) &&
          includesAnyKeyword(
            `${freeArticle.title} ${freeArticle.note}`,
            categoryDefinition.keywords,
          ),
      ).length;
      const ocrPvBoost =
        article.accessImportItems.reduce(
          (total, item) => total + Math.max(item.nextPv ?? item.extractedPv, 0),
          0,
        ) > 0
          ? 5
          : 0;
      const saleBoost = article.noteSaleTransactions.length > 0 ? 5 : 0;
      const aiHintBoost = article.aiAnalysisRuns.some((run) =>
        `${run.outputText ?? ""} ${run.outputJson ?? ""}`.includes(categoryDefinition.label),
      )
        ? 8
        : 0;
      const score = Math.min(
        100,
        ideaCount * 12 + draftCount * 24 + publishedCount * 28 + ocrPvBoost + saleBoost + aiHintBoost,
      );
      const status = getStatus(score);
      const expectedImpact = calculateExpectedImpact({
        article,
        category: categoryDefinition.label,
        score,
      });

      return {
        category: categoryDefinition.label,
        status,
        score,
        priority: getPriority(score, article),
        ideaCount,
        draftCount,
        publishedCount,
        stars: getStars(score),
        recommendation: buildRecommendation(categoryDefinition.label, article.title),
        expectedImpact,
      };
    });
    const missingCategories = categories
      .filter((category) => category.status === "不足")
      .sort((left, right) => right.expectedImpact - left.expectedImpact)
      .map((category) => category.category);
    const expectedImpact = categories
      .filter((category) => category.status === "不足")
      .reduce((total, category) => total + category.expectedImpact, 0);
    const priority = expectedImpact >= article.price * 2 || missingCategories.length >= 5
      ? "高"
      : expectedImpact > 0 || missingCategories.length >= 3
        ? "中"
        : "低";
    const topMissing = missingCategories[0] ?? categories[0]?.category ?? "認知";

    return {
      articleId: article.id,
      title: article.title,
      price: article.price,
      pv: article.pv,
      purchases: article.purchases,
      updatedAt: article.updatedAt,
      conversionRate,
      freeArticleCount:
        article.freeArticleIdeas.length +
        article.freeArticleDrafts.filter(
          (draft) => draft.status.toUpperCase() !== "ARCHIVED",
        ).length,
      missingCategories,
      recommendedThemes: missingCategories
        .slice(0, 3)
        .map((category) => buildRecommendedTheme(category, article.title)),
      priority,
      expectedImpact,
      expectedEffect:
        missingCategories.length > 0
          ? `${topMissing}記事を追加すると、送客改善が期待できます。`
          : "主要導線は一定数そろっています。",
      categories,
      aiImprovementHint:
        missingCategories.length > 0
          ? `この商品は${topMissing}記事が不足しています。${topMissing}記事を2本追加すると送客改善が期待できます。`
          : "無料記事導線は比較的そろっています。既存記事のCTA改善を優先できます。",
    } satisfies ArticleContentGap;
  });
}

export function getContentGapSummary(gaps: ArticleContentGap[]) {
  const missingCategoryCounts = new Map<string, number>();

  gaps.forEach((gap) => {
    gap.missingCategories.forEach((category) => {
      missingCategoryCounts.set(category, (missingCategoryCounts.get(category) ?? 0) + 1);
    });
  });

  return {
    topMissingCategories: [...missingCategoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10),
    priorityProducts: [...gaps]
      .sort((left, right) => right.expectedImpact - left.expectedImpact)
      .slice(0, 5),
    freeArticleShortageRanking: [...gaps]
      .sort((left, right) => right.missingCategories.length - left.missingCategories.length)
      .slice(0, 5),
    expectedRevenueImpact: gaps.reduce((total, gap) => total + gap.expectedImpact, 0),
  };
}
