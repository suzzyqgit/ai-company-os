"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  formatTokyoDateInputValue,
  normalizeDateInputToTokyoDate,
} from "./calculators";
import { syncArticleTotalsFromDailyMetrics } from "./queries";

type MetricField = "date" | "pv" | "purchases" | "revenue" | "masterTransitions";

export type DailyMetricActionState = {
  fieldErrors?: Partial<Record<MetricField, string>>;
  formError?: string;
};

export type BulkDailyMetricActionState = {
  formError?: string;
  rowErrors?: Record<string, string>;
  successMessage?: string;
};

const requiredFields = [
  "date",
  "pv",
  "purchases",
  "revenue",
  "masterTransitions",
] as const;

const numericFields = ["pv", "purchases", "revenue", "masterTransitions"] as const;

const fieldLabels: Record<MetricField, string> = {
  date: "日付",
  pv: "PV",
  purchases: "購入数",
  revenue: "売上",
  masterTransitions: "Master遷移数",
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseNonNegativeInteger(value: string) {
  if (value === "") {
    return 0;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    return null;
  }

  return number;
}

function parseDailyMetricFormData(formData: FormData) {
  const raw = {
    date: getString(formData, "date"),
    pv: getString(formData, "pv"),
    purchases: getString(formData, "purchases"),
    revenue: getString(formData, "revenue"),
    masterTransitions: getString(formData, "masterTransitions"),
  };
  const fieldErrors: DailyMetricActionState["fieldErrors"] = {};

  requiredFields.forEach((field) => {
    if (raw[field] === "") {
      fieldErrors[field] = `${fieldLabels[field]}は必須です。`;
    }
  });

  numericFields.forEach((field) => {
    if (raw[field] === "") {
      return;
    }

    const value = Number(raw[field]);

    if (!Number.isInteger(value)) {
      fieldErrors[field] = `${fieldLabels[field]}は整数で入力してください。`;
      return;
    }

    if (value < 0) {
      fieldErrors[field] = `${fieldLabels[field]}は0以上で入力してください。`;
    }
  });

  const date = normalizeDateInputToTokyoDate(raw.date);
  if (raw.date !== "" && date === null) {
    fieldErrors.date = "日付は正しい形式で入力してください。";
  }

  if (Object.keys(fieldErrors).length > 0 || date === null) {
    return { fieldErrors };
  }

  return {
    data: {
      date,
      pv: Number(raw.pv),
      purchases: Number(raw.purchases),
      revenue: Number(raw.revenue),
      masterTransitions: Number(raw.masterTransitions),
    },
  };
}

export async function upsertArticleDailyMetricAction(
  articleId: string,
  _previousState: DailyMetricActionState,
  formData: FormData,
): Promise<DailyMetricActionState> {
  void _previousState;

  const parsed = parseDailyMetricFormData(formData);

  if ("fieldErrors" in parsed) {
    return { fieldErrors: parsed.fieldErrors };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.articleDailyMetric.upsert({
        where: {
          articleId_date: {
            articleId,
            date: parsed.data.date,
          },
        },
        update: {
          pv: parsed.data.pv,
          purchases: parsed.data.purchases,
          revenue: parsed.data.revenue,
          masterTransitions: parsed.data.masterTransitions,
        },
        create: {
          articleId,
          date: parsed.data.date,
          pv: parsed.data.pv,
          purchases: parsed.data.purchases,
          revenue: parsed.data.revenue,
          masterTransitions: parsed.data.masterTransitions,
        },
      });

      await syncArticleTotalsFromDailyMetrics(articleId, transaction);
    });
  } catch {
    return {
      formError: "日次実績の保存に失敗しました。記事が存在するか確認してください。",
    };
  }

  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath(`/articles/${articleId}`);
  redirect(`/articles/${articleId}`);
}

export async function bulkUpsertArticleDailyMetricsAction(
  _previousState: BulkDailyMetricActionState,
  formData: FormData,
): Promise<BulkDailyMetricActionState> {
  void _previousState;

  const rawDate = getString(formData, "date");
  const date = normalizeDateInputToTokyoDate(rawDate);
  const redirectQuery = getString(formData, "redirectQuery");

  if (date === null) {
    return {
      formError: "対象日は正しい日付で入力してください。",
    };
  }

  const rawArticleIds = formData.getAll("articleId");
  const articleIds = rawArticleIds.filter(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  const uniqueArticleIds = Array.from(new Set(articleIds));

  if (uniqueArticleIds.length === 0) {
    return {
      formError: "保存対象の記事がありません。",
    };
  }

  const articles = await prisma.article.findMany({
    where: {
      id: {
        in: uniqueArticleIds,
      },
    },
    select: {
      id: true,
    },
  });
  const existingArticleIds = new Set(articles.map((article) => article.id));
  const existingMetrics = await prisma.articleDailyMetric.findMany({
    where: {
      articleId: {
        in: uniqueArticleIds,
      },
      date,
    },
    select: {
      articleId: true,
    },
  });
  const existingMetricArticleIds = new Set(
    existingMetrics.map((metric) => metric.articleId),
  );
  const rowErrors: Record<string, string> = {};
  const parsedRows: Array<{
    articleId: string;
    pv: number;
    purchases: number;
    revenue: number;
    masterTransitions: number;
    shouldPersist: boolean;
  }> = [];

  uniqueArticleIds.forEach((articleId) => {
    if (!existingArticleIds.has(articleId)) {
      rowErrors[articleId] = "存在しない記事です。";
      return;
    }

    const raw = {
      pv: getString(formData, `pv-${articleId}`),
      purchases: getString(formData, `purchases-${articleId}`),
      revenue: getString(formData, `revenue-${articleId}`),
      masterTransitions: getString(formData, `masterTransitions-${articleId}`),
    };
    const pv = parseNonNegativeInteger(raw.pv);
    const purchases = parseNonNegativeInteger(raw.purchases);
    const revenue = parseNonNegativeInteger(raw.revenue);
    const masterTransitions = parseNonNegativeInteger(raw.masterTransitions);

    if (
      pv === null ||
      purchases === null ||
      revenue === null ||
      masterTransitions === null
    ) {
      rowErrors[articleId] = "PV、購入数、売上、Master遷移数は0以上の整数で入力してください。";
      return;
    }

    parsedRows.push({
      articleId,
      pv,
      purchases,
      revenue,
      masterTransitions,
      shouldPersist:
        pv > 0 ||
        purchases > 0 ||
        revenue > 0 ||
        masterTransitions > 0 ||
        existingMetricArticleIds.has(articleId),
    });
  });

  if (Object.keys(rowErrors).length > 0) {
    return {
      rowErrors,
      formError: "入力内容に問題があります。該当行を確認してください。",
    };
  }

  const rowsToPersist = parsedRows.filter((row) => row.shouldPersist);
  const affectedArticleIds = new Set(rowsToPersist.map((row) => row.articleId));

  try {
    await prisma.$transaction(async (transaction) => {
      for (const row of rowsToPersist) {
        await transaction.articleDailyMetric.upsert({
          where: {
            articleId_date: {
              articleId: row.articleId,
              date,
            },
          },
          update: {
            pv: row.pv,
            purchases: row.purchases,
            revenue: row.revenue,
            masterTransitions: row.masterTransitions,
          },
          create: {
            articleId: row.articleId,
            date,
            pv: row.pv,
            purchases: row.purchases,
            revenue: row.revenue,
            masterTransitions: row.masterTransitions,
          },
        });
      }

      for (const articleId of affectedArticleIds) {
        await syncArticleTotalsFromDailyMetrics(articleId, transaction);
      }
    });
  } catch {
    return {
      formError: "一括保存に失敗しました。入力内容を確認してください。",
    };
  }

  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath("/articles");
  revalidatePath("/metrics/daily");
  affectedArticleIds.forEach((articleId) => {
    revalidatePath(`/articles/${articleId}`);
  });

  const query = redirectQuery || `date=${formatTokyoDateInputValue(date)}`;
  redirect(`/metrics/daily?${query}&saved=1`);
}
