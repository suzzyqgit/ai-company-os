import Link from "next/link";
import DailyMetricsBulkForm from "@/components/articles/DailyMetricsBulkForm";
import { bulkUpsertArticleDailyMetricsAction } from "@/features/metrics/actions";
import {
  formatTokyoDateInputValue,
  normalizeDateInputToTokyoDate,
} from "@/features/metrics/calculators";
import { getDailyMetricInputRows } from "@/features/metrics/queries";

export const dynamic = "force-dynamic";

type DailyMetricsPageProps = {
  searchParams: Promise<{
    date?: string | string[];
    q?: string | string[];
    filled?: string | string[];
    saved?: string | string[];
  }>;
};

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getTargetDate(value: string) {
  const parsed = normalizeDateInputToTokyoDate(value);

  if (parsed) {
    return parsed;
  }

  const todayInput = formatTokyoDateInputValue(new Date());
  const today = normalizeDateInputToTokyoDate(todayInput);

  if (today === null) {
    throw new Error("Failed to resolve today");
  }

  return today;
}

function buildQueryString({
  date,
  query,
  filledOnly,
}: {
  date: string;
  query: string;
  filledOnly: boolean;
}) {
  const params = new URLSearchParams();
  params.set("date", date);

  if (query) {
    params.set("q", query);
  }

  if (filledOnly) {
    params.set("filled", "1");
  }

  return params.toString();
}

function buildDailyMetricsExportHref(date: string) {
  const params = new URLSearchParams();
  params.set("scope", "day");
  params.set("date", date);

  return `/api/exports/metrics?${params.toString()}`;
}

export default async function DailyMetricsPage({
  searchParams,
}: DailyMetricsPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = getQueryValue(resolvedSearchParams.q).trim();
  const filledOnly = getQueryValue(resolvedSearchParams.filled) === "1";
  const saved = getQueryValue(resolvedSearchParams.saved) === "1";
  const targetDate = getTargetDate(getQueryValue(resolvedSearchParams.date));
  const targetDateInput = formatTokyoDateInputValue(targetDate);
  const rows = await getDailyMetricInputRows({
    date: targetDate,
    query,
    filledOnly,
  });
  const redirectQuery = buildQueryString({
    date: targetDateInput,
    query,
    filledOnly,
  });
  const exportHref = buildDailyMetricsExportHref(targetDateInput);
  const formRows = rows.map((row) => ({
    articleId: row.article.id,
    title: row.article.title,
    price: row.article.price,
    totalPv: row.article.pv,
    totalPurchases: row.article.purchases,
    hasCsvSales: row.hasCsvSales,
    metric: row.metric
      ? {
          pv: row.metric.pv,
          purchases: row.metric.purchases,
          revenue: row.metric.revenue,
          masterTransitions: row.metric.masterTransitions,
        }
      : null,
  }));

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              Dashboardへ戻る
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-normal sm:text-3xl">
              日次実績入力
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              対象日のPV、購入数、売上、Master遷移数を記事ごとにまとめて登録します。
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={exportHref}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              CSVエクスポート
            </Link>
            <Link
              href="/analytics"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              売上分析
            </Link>
            <Link
              href="/articles"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              記事一覧
            </Link>
          </div>
        </div>

        {saved ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            日次実績を保存しました。
          </div>
        ) : null}

        <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <form
            action="/metrics/daily"
            className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_auto_auto]"
          >
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-zinc-700"
              >
                対象日
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={targetDateInput}
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <div>
              <label
                htmlFor="q"
                className="block text-sm font-medium text-zinc-700"
              >
                タイトル検索
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="記事タイトルで検索"
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <label className="flex items-end gap-2 pb-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                name="filled"
                value="1"
                defaultChecked={filledOnly}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900"
              />
              入力済みのみ
            </label>

            <div className="flex flex-col gap-2 lg:justify-end">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              >
                表示
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-zinc-600">
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              対象日: {targetDateInput}
            </span>
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              表示件数: {formRows.length}件
            </span>
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              検索: {query || "指定なし"}
            </span>
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              絞り込み: {filledOnly ? "入力済みのみ" : "すべて"}
            </span>
          </div>
        </section>

        <DailyMetricsBulkForm
          key={redirectQuery}
          action={bulkUpsertArticleDailyMetricsAction}
          date={targetDateInput}
          rows={formRows}
          redirectQuery={redirectQuery}
        />
      </div>
    </main>
  );
}
