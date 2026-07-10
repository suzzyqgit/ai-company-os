export const AI_ANALYSIS_TYPE = "article_improvement";

export type Priority = "high" | "medium" | "low";

export type ArticleAnalysisReport = {
  summary: string;
  issues: Array<{
    title: string;
    reason: string;
    priority: Priority;
  }>;
  actions: Array<{
    title: string;
    detail: string;
    expectedEffect: string;
    priority: Priority;
  }>;
  titleSuggestions: string[];
  metricsInterpretation: {
    pv: string;
    conversionRate: string;
    masterTransitionRate: string;
  };
  limitations: string[];
};

export type ArticleAnalysisInput = {
  analysisType: typeof AI_ANALYSIS_TYPE;
  promptVersion: number;
  model: string;
  article: {
    id: string;
    title: string;
    price: number;
    totalPv: number;
    totalPurchases: number;
    totalConversionRate: number;
    note: string;
  };
  last30Days: {
    from: string;
    to: string;
    totals: {
      pv: number;
      purchases: number;
      revenue: number;
      masterTransitions: number;
      conversionRate: number;
      masterTransitionRate: number;
    };
    daily: Array<{
      date: string;
      pv: number;
      purchases: number;
      revenue: number;
      masterTransitions: number;
      conversionRate: number;
      masterTransitionRate: number;
    }>;
  };
};

export const articleAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "issues",
    "actions",
    "titleSuggestions",
    "metricsInterpretation",
    "limitations",
  ],
  properties: {
    summary: {
      type: "string",
      description: "記事実績データに基づく全体評価。",
    },
    issues: {
      type: "array",
      description: "数値から読み取れる問題点。",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason", "priority"],
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    actions: {
      type: "array",
      maxItems: 5,
      description: "優先度順の改善アクション。最大5件。",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "expectedEffect", "priority"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          expectedEffect: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    titleSuggestions: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      description: "タイトル改善案を必ず5件。",
      items: { type: "string" },
    },
    metricsInterpretation: {
      type: "object",
      additionalProperties: false,
      required: ["pv", "conversionRate", "masterTransitionRate"],
      properties: {
        pv: { type: "string" },
        conversionRate: { type: "string" },
        masterTransitionRate: { type: "string" },
      },
    },
    limitations: {
      type: "array",
      description: "本文未提供など、この分析では判断できないこと。",
      items: { type: "string" },
    },
  },
} as const;

function isPriority(value: unknown): value is Priority {
  return value === "high" || value === "medium" || value === "low";
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseArticleAnalysisReport(value: string): ArticleAnalysisReport {
  const parsed: unknown = JSON.parse(value);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("AI output is not an object");
  }

  const report = parsed as ArticleAnalysisReport;

  if (
    typeof report.summary !== "string" ||
    !Array.isArray(report.issues) ||
    !Array.isArray(report.actions) ||
    !isStringArray(report.titleSuggestions) ||
    report.titleSuggestions.length !== 5 ||
    typeof report.metricsInterpretation?.pv !== "string" ||
    typeof report.metricsInterpretation?.conversionRate !== "string" ||
    typeof report.metricsInterpretation?.masterTransitionRate !== "string" ||
    !isStringArray(report.limitations)
  ) {
    throw new Error("AI output does not match the expected report shape");
  }

  report.issues.forEach((issue) => {
    if (
      typeof issue.title !== "string" ||
      typeof issue.reason !== "string" ||
      !isPriority(issue.priority)
    ) {
      throw new Error("AI output has an invalid issue");
    }
  });

  report.actions.forEach((action) => {
    if (
      typeof action.title !== "string" ||
      typeof action.detail !== "string" ||
      typeof action.expectedEffect !== "string" ||
      !isPriority(action.priority)
    ) {
      throw new Error("AI output has an invalid action");
    }
  });

  return report;
}
