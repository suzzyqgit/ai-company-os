import { prisma } from "@/lib/prisma";
import {
  formatTokyoDateInputValue,
  normalizeDateInputToTokyoDate,
} from "@/features/metrics/calculators";
import { calculatePurchaseRate } from "@/app/articles/utils";
import {
  AI_ANALYSIS_TYPE,
  parseArticleAnalysisReport,
  type ArticleAnalysisInput,
  type ArticleAnalysisReport,
} from "./schemas";
import { ARTICLE_ANALYSIS_PROMPT_VERSION } from "./prompts";
import { defaultAiModel } from "./openai";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

type AiAnalysisRunRecord = {
  id: string;
  status: string;
  model: string;
  outputJson: string | null;
  outputText: string | null;
  inputHash: string;
  createdAt: Date;
};

export type ArticleAiAnalysisView = {
  id: string;
  status: string;
  model: string;
  inputHash: string;
  createdAt: Date;
  report: ArticleAnalysisReport;
};

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function getTodayTokyoDate() {
  const today = normalizeDateInputToTokyoDate(formatTokyoDateInputValue(new Date()));

  if (today === null) {
    throw new Error("Failed to resolve today");
  }

  return today;
}

function divideRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function parseStoredReport(run: AiAnalysisRunRecord) {
  const source = run.outputJson ?? run.outputText;

  if (!source) {
    return null;
  }

  try {
    return parseArticleAnalysisReport(source);
  } catch {
    return null;
  }
}

export function toArticleAiAnalysisView(
  run: AiAnalysisRunRecord | null,
): ArticleAiAnalysisView | null {
  if (!run) {
    return null;
  }

  const report = parseStoredReport(run);

  if (!report) {
    return null;
  }

  return {
    id: run.id,
    status: run.status,
    model: run.model,
    inputHash: run.inputHash,
    createdAt: run.createdAt,
    report,
  };
}

export async function buildArticleAnalysisInput(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
  });

  if (!article) {
    return null;
  }

  const to = getTodayTokyoDate();
  const from = addDays(to, -29);
  const exclusiveTo = addDays(to, 1);
  const metrics = await prisma.articleDailyMetric.findMany({
    where: {
      articleId,
      date: {
        gte: from,
        lt: exclusiveTo,
      },
    },
    orderBy: {
      date: "asc",
    },
  });
  const metricMap = new Map(
    metrics.map((metric) => [formatTokyoDateInputValue(metric.date), metric]),
  );
  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = addDays(from, index);
    const dateInput = formatTokyoDateInputValue(date);
    const metric = metricMap.get(dateInput);
    const pv = metric?.pv ?? 0;
    const purchases = metric?.purchases ?? 0;
    const revenue = metric?.revenue ?? 0;
    const masterTransitions = metric?.masterTransitions ?? 0;

    return {
      date: dateInput,
      pv,
      purchases,
      revenue,
      masterTransitions,
      conversionRate: divideRate(purchases, pv),
      masterTransitionRate: divideRate(masterTransitions, purchases),
    };
  });
  const totals = daily.reduce(
    (current, metric) => ({
      pv: current.pv + metric.pv,
      purchases: current.purchases + metric.purchases,
      revenue: current.revenue + metric.revenue,
      masterTransitions: current.masterTransitions + metric.masterTransitions,
    }),
    {
      pv: 0,
      purchases: 0,
      revenue: 0,
      masterTransitions: 0,
    },
  );

  return {
    analysisType: AI_ANALYSIS_TYPE,
    promptVersion: ARTICLE_ANALYSIS_PROMPT_VERSION,
    model: defaultAiModel,
    article: {
      id: article.id,
      title: article.title,
      price: article.price,
      totalPv: article.pv,
      totalPurchases: article.purchases,
      totalConversionRate: calculatePurchaseRate(article.purchases, article.pv),
      note: article.note,
    },
    last30Days: {
      from: formatTokyoDateInputValue(from),
      to: formatTokyoDateInputValue(to),
      totals: {
        ...totals,
        conversionRate: divideRate(totals.purchases, totals.pv),
        masterTransitionRate: divideRate(
          totals.masterTransitions,
          totals.purchases,
        ),
      },
      daily,
    },
  } satisfies ArticleAnalysisInput;
}

export function getCachedSuccessfulAnalysis(inputHash: string) {
  return prisma.aiAnalysisRun.findFirst({
    where: {
      inputHash,
      status: "succeeded",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      status: true,
      model: true,
      inputHash: true,
      outputJson: true,
      outputText: true,
      createdAt: true,
    },
  });
}

export function getLatestSuccessfulArticleAnalysis(articleId: string) {
  return prisma.aiAnalysisRun.findFirst({
    where: {
      articleId,
      status: "succeeded",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      status: true,
      model: true,
      inputHash: true,
      outputJson: true,
      outputText: true,
      createdAt: true,
    },
  });
}
