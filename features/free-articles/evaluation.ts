export type FreeArticleEvaluationGrade = "S" | "A" | "B" | "C" | "D";
export type FreeArticleImprovementPriority = "高" | "中" | "低";
export type FreeArticleEvaluationPhase =
  | "collecting"
  | "reference"
  | "formal"
  | "unavailable";

export type FreeArticleEvaluationInput = {
  id: string;
  title: string;
  publishedPv: number;
  referralCount: number;
  purchaseCount: number;
  improvementCount: number;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type FreeArticleEvaluation = {
  score: number;
  grade: FreeArticleEvaluationGrade;
  priority: FreeArticleImprovementPriority;
  phase: FreeArticleEvaluationPhase;
  phaseLabel: string;
  daysSincePublished: number | null;
  reasons: string[];
};

const gradeRank = {
  D: 5,
  C: 4,
  B: 3,
  A: 2,
  S: 1,
} satisfies Record<FreeArticleEvaluationGrade, number>;

const priorityRank = {
  高: 3,
  中: 2,
  低: 1,
} satisfies Record<FreeArticleImprovementPriority, number>;

function getDaysSince(date: Date | null, now: Date) {
  if (!date) {
    return null;
  }

  const diffMs = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function getFreeArticleEvaluationPhase(
  publishedAt: Date | null,
  now = new Date(),
) {
  const daysSincePublished = getDaysSince(publishedAt, now);

  if (daysSincePublished === null) {
    return {
      phase: "unavailable" as const,
      phaseLabel: "公開日未設定",
      daysSincePublished,
    };
  }

  if (daysSincePublished <= 2) {
    return {
      phase: "collecting" as const,
      phaseLabel: "データ収集中",
      daysSincePublished,
    };
  }

  if (daysSincePublished <= 6) {
    return {
      phase: "reference" as const,
      phaseLabel: "参考評価",
      daysSincePublished,
    };
  }

  return {
    phase: "formal" as const,
    phaseLabel: "正式評価",
    daysSincePublished,
  };
}

function toGrade(score: number): FreeArticleEvaluationGrade {
  if (score >= 90) {
    return "S";
  }

  if (score >= 75) {
    return "A";
  }

  if (score >= 60) {
    return "B";
  }

  if (score >= 40) {
    return "C";
  }

  return "D";
}

function toPriority(grade: FreeArticleEvaluationGrade) {
  if (grade === "D" || grade === "C") {
    return "高";
  }

  if (grade === "B") {
    return "中";
  }

  return "低";
}

export function evaluateFreeArticle(
  article: FreeArticleEvaluationInput,
  now = new Date(),
): FreeArticleEvaluation {
  const deductions: { points: number; reason: string }[] = [];
  const evaluationPhase = getFreeArticleEvaluationPhase(article.publishedAt, now);
  const { daysSincePublished } = evaluationPhase;
  const daysSinceImproved =
    article.improvementCount > 0 ? getDaysSince(article.updatedAt, now) : null;

  if (article.publishedPv <= 50) {
    deductions.push({
      points: 30,
      reason: "PVが50以下",
    });
  } else if (article.publishedPv <= 100) {
    deductions.push({
      points: 20,
      reason: "PVが100以下",
    });
  }

  if (article.referralCount === 0) {
    deductions.push({
      points: 25,
      reason: "送客が0",
    });
  } else if (article.referralCount <= 3) {
    deductions.push({
      points: 15,
      reason: "送客が少ない",
    });
  }

  if (article.purchaseCount === 0) {
    deductions.push({
      points: 10,
      reason: "購入につながっていない",
    });
  }

  if (article.improvementCount === 0) {
    deductions.push({
      points: 10,
      reason: "改善履歴なし",
    });
  } else if (daysSinceImproved !== null && daysSinceImproved >= 14) {
    deductions.push({
      points: 8,
      reason: "最終改善から14日以上",
    });
  }

  if (daysSincePublished === null) {
    deductions.push({
      points: 10,
      reason: "公開日未設定",
    });
  } else if (daysSincePublished >= 7) {
    deductions.push({
      points: 10,
      reason: "公開7日経過",
    });
  }

  const score = Math.max(
    0,
    100 - deductions.reduce((total, deduction) => total + deduction.points, 0),
  );
  const grade = toGrade(score);

  return {
    score,
    grade,
    priority: toPriority(grade),
    phase: evaluationPhase.phase,
    phaseLabel: evaluationPhase.phaseLabel,
    daysSincePublished,
    reasons: deductions
      .sort((left, right) => right.points - left.points)
      .slice(0, 3)
      .map((deduction) => deduction.reason),
  };
}

export function compareFreeArticleEvaluations(
  left: FreeArticleEvaluationInput & { evaluation: FreeArticleEvaluation },
  right: FreeArticleEvaluationInput & { evaluation: FreeArticleEvaluation },
) {
  const gradeDiff =
    gradeRank[left.evaluation.grade] - gradeRank[right.evaluation.grade];

  if (gradeDiff !== 0) {
    return gradeDiff;
  }

  const priorityDiff =
    priorityRank[right.evaluation.priority] -
    priorityRank[left.evaluation.priority];

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const scoreDiff = left.evaluation.score - right.evaluation.score;

  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const pvDiff = right.publishedPv - left.publishedPv;

  if (pvDiff !== 0) {
    return pvDiff;
  }

  return left.id.localeCompare(right.id);
}
