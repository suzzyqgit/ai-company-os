import type { ArticleContentGap } from "@/features/content-gap/calculators";
import type {
  TodayFreeArticlePlan,
  TodayImprovementArticle,
  TodayKpis,
} from "./calculators";

export type TodayAdvisorPriority = "高" | "中" | "低";

export type TodayAdvisorRecommendation = {
  title: string;
  reason: string;
  expectedEffect: string;
  priority: TodayAdvisorPriority;
  estimatedMinutes: number;
  href: string;
  buttonLabel: string;
};

type AdvisorInput = {
  today: Date;
  todayKpis: TodayKpis;
  improvementArticle: TodayImprovementArticle | null;
  freeArticlePlan: TodayFreeArticlePlan | null;
  contentGaps: ArticleContentGap[];
  latestOcrAt: Date | null;
  latestCsvAt: Date | null;
};

type AdvisorCandidate = TodayAdvisorRecommendation & {
  score: number;
  tieBreaker: number;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function getDaysSince(date: Date | null, today: Date) {
  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / millisecondsPerDay));
}

function getPriority(score: number): TodayAdvisorPriority {
  if (score >= 80) {
    return "高";
  }

  if (score >= 55) {
    return "中";
  }

  return "低";
}

function formatImpact(value: number | null | undefined) {
  if (!value || value <= 0) {
    return "売上判断の精度改善";
  }

  return `+¥${value.toLocaleString("ja-JP")} 見込み`;
}

function buildImportCandidate({
  title,
  href,
  buttonLabel,
  latestAt,
  today,
  baseScore,
  reasonFresh,
  reasonStale,
  tieBreaker,
}: {
  title: string;
  href: string;
  buttonLabel: string;
  latestAt: Date | null;
  today: Date;
  baseScore: number;
  reasonFresh: string;
  reasonStale: string;
  tieBreaker: number;
}): AdvisorCandidate {
  const daysSince = getDaysSince(latestAt, today);
  const isStale = daysSince >= 1;
  const score = isStale ? baseScore + Math.min(18, daysSince * 4) : 28;

  return {
    title,
    reason: isStale ? reasonStale : reasonFresh,
    expectedEffect: isStale ? "今日の判断材料を最新化" : "取込済みのため優先度は低め",
    priority: getPriority(score),
    estimatedMinutes: 5,
    href,
    buttonLabel,
    score,
    tieBreaker,
  };
}

export function buildTodayAdvisorRecommendation({
  today,
  todayKpis,
  improvementArticle,
  freeArticlePlan,
  contentGaps,
  latestOcrAt,
  latestCsvAt,
}: AdvisorInput): TodayAdvisorRecommendation {
  const strongestGap = [...contentGaps].sort((left, right) => {
    if (right.expectedImpact !== left.expectedImpact) {
      return right.expectedImpact - left.expectedImpact;
    }

    return left.articleId.localeCompare(right.articleId);
  })[0];
  const candidates: AdvisorCandidate[] = [
    buildImportCandidate({
      title: "noteアクセスOCRを取り込む",
      href: "/imports/note-access",
      buttonLabel: "OCRを取り込む",
      latestAt: latestOcrAt,
      today,
      baseScore: 86,
      reasonFresh: "PVは今日すでに取り込まれています。ほかの改善作業を優先できます。",
      reasonStale:
        "PVが古いままだと、改善対象やContent Gapの優先順位がずれます。まず数字を最新化するのが安全です。",
      tieBreaker: 1,
    }),
    buildImportCandidate({
      title: "販売履歴CSVを同期する",
      href: "/imports/note-sales",
      buttonLabel: "CSVを同期する",
      latestAt: latestCsvAt,
      today,
      baseScore: 82,
      reasonFresh: "販売履歴は今日すでに同期されています。次は改善作業へ進めます。",
      reasonStale:
        "購入数と売上が古いと、売上インパクトの高い記事を選びにくくなります。販売履歴を先に同期します。",
      tieBreaker: 2,
    }),
  ];

  if (improvementArticle) {
    const conversionGap = Math.max(0, 10 - improvementArticle.conversionRate);
    const score =
      70 +
      Math.min(18, improvementArticle.pv / 80) +
      conversionGap * 1.4 +
      (improvementArticle.price >= 980 ? 5 : 0);

    candidates.push({
      title: "購入率が低い記事を改善する",
      reason: `${improvementArticle.title} はPV ${improvementArticle.pv.toLocaleString(
        "ja-JP",
      )}、購入率 ${improvementArticle.conversionRate.toFixed(
        1,
      )}% です。PVがあるため、タイトルや無料部分の改善が売上に直結しやすい状態です。`,
      expectedEffect: "購入率改善による売上増",
      priority: getPriority(score),
      estimatedMinutes: 20,
      href: "/ai-improvements",
      buttonLabel: "改善案を見る",
      score,
      tieBreaker: 3,
    });
  }

  if (freeArticlePlan) {
    const pipelineBoost =
      freeArticlePlan.pipelineStatus === "READY"
        ? 18
        : freeArticlePlan.pipelineStatus === "DRAFT" ||
            freeArticlePlan.pipelineStatus === "REVIEW"
          ? 10
          : 0;
    const score = 62 + pipelineBoost + Math.min(18, (freeArticlePlan.expectedImpact ?? 0) / 400);

    candidates.push({
      title:
        freeArticlePlan.pipelineStatus === "READY"
          ? "無料記事を1本公開する"
          : "無料記事を1本作成する",
      reason: `${freeArticlePlan.destinationArticleTitle} の ${freeArticlePlan.missingCategory} 導線が不足しています。無料記事から有料記事への入口を増やします。`,
      expectedEffect: formatImpact(freeArticlePlan.expectedImpact),
      priority: getPriority(score),
      estimatedMinutes: freeArticlePlan.pipelineStatus === "READY" ? 10 : 35,
      href: freeArticlePlan.href,
      buttonLabel: freeArticlePlan.actionLabel,
      score,
      tieBreaker: 4,
    });
  }

  if (strongestGap) {
    const score = 54 + Math.min(30, strongestGap.expectedImpact / 350);

    candidates.push({
      title: "Content Gapを埋める",
      reason: `${strongestGap.title} は ${
        strongestGap.missingCategories[0] ?? "導線"
      } が不足しています。無料記事やCTA記事を追加すると送客改善が期待できます。`,
      expectedEffect: formatImpact(strongestGap.expectedImpact),
      priority: getPriority(score),
      estimatedMinutes: 25,
      href: "/content-gap",
      buttonLabel: "Gapを見る",
      score,
      tieBreaker: 5,
    });
  }

  if (todayKpis.todayRevenue === 0 && todayKpis.todayPurchases === 0) {
    candidates.push({
      title: "今日の数字を確認する",
      reason: "今日の売上と購入数がまだ0です。取込が未完了か、改善対象の見直しが必要な可能性があります。",
      expectedEffect: "今日の優先順位を再確認",
      priority: "中",
      estimatedMinutes: 10,
      href: "/today",
      buttonLabel: "Todayを確認",
      score: 58,
      tieBreaker: 6,
    });
  }

  return candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.tieBreaker - right.tieBreaker;
  })[0];
}
