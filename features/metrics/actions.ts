"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeDateInputToTokyoDate } from "./calculators";
import { syncArticleTotalsFromDailyMetrics } from "./queries";

type MetricField = "date" | "pv" | "purchases" | "revenue" | "masterTransitions";

export type DailyMetricActionState = {
  fieldErrors?: Partial<Record<MetricField, string>>;
  formError?: string;
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
