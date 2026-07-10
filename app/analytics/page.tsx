import Link from "next/link";
import {
  getComparisonMetrics,
  getImprovementArticles,
  getMasterTransitionRate,
  getPurchaseRate,
  getTopArticles,
  getTopArticlesByPurchaseRate,
  resolveAnalyticsPeriod,
  type ArticleMetricSummary,
  type ComparisonMetric,
  type DailyMetricSummary,
  type MetricTotals,
} from "@/features/analytics/calculators";
import { getAnalyticsData } from "@/features/analytics/queries";
import { tokyoDateFormatter } from "@/features/metrics/calculators";
import { numberFormatter, yenFormatter } from "../articles/utils";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  searchParams: Promise<{
    range?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
};

const rangeOptions = [
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨日" },
  { value: "7d", label: "過去7日" },
  { value: "30d", label: "過去30日" },
  { value: "thisMonth", label: "今月" },
  { value: "lastMonth", label: "先月" },
  { value: "custom", label: "カスタム期間" },
];

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMetricValue(value: number, type: ComparisonMetric["type"]) {
  if (type === "currency") {
    return yenFormatter.format(value);
  }

  if (type === "rate") {
    return formatRate(value);
  }

  return numberFormatter.format(value);
}

function formatDelta(value: number, type: ComparisonMetric["type"]) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMetricValue(value, type)}`;
}

function formatChangeRate(value: number | null) {
  if (value === null) {
    return "比較不可";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function getDeltaClass(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-red-700";
  }

  return "text-zinc-600";
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-zinc-200 px-5 py-4">
      <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      ) : null}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-5 py-8 text-sm text-zinc-500">{message}</p>;
}

function KpiCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-950">
        {value}
      </p>
      <p className="mt-2 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

function MetricCells({ article }: { article: ArticleMetricSummary }) {
  return (
    <>
      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
        {numberFormatter.format(article.pv)}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
        {numberFormatter.format(article.purchases)}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-zinc-950">
        {formatRate(getPurchaseRate(article))}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
        {yenFormatter.format(article.revenue)}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
        {numberFormatter.format(article.masterTransitions)}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
        {formatRate(getMasterTransitionRate(article))}
      </td>
    </>
  );
}

function RankingTable({
  title,
  description,
  articles,
  emptyMessage,
}: {
  title: string;
  description: string;
  articles: ArticleMetricSummary[];
  emptyMessage: string;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-200 bg-white shadow-sm">
      <SectionHeader title={title} description={description} />
      {articles.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  記事タイトル
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  PV
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  購入数
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  購入率
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  売上
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  Master遷移数
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  Master遷移率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {articles.map((article) => (
                <tr key={article.articleId} className="hover:bg-zinc-50">
                  <td className="min-w-64 px-5 py-4 font-medium text-zinc-950">
                    <Link
                      href={`/articles/${article.articleId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {article.title}
                    </Link>
                  </td>
                  <MetricCells article={article} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </section>
  );
}

function DailyTable({ rows }: { rows: DailyMetricSummary[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-200 bg-white shadow-sm">
      <SectionHeader
        title="日別実績"
        description="データがない日も0として表示します。"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                日付
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                PV
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                購入数
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                購入率
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                売上
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                Master遷移数
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                Master遷移率
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {rows.map((row) => (
              <tr key={row.dateInput} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                  {tokyoDateFormatter.format(row.date)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                  {numberFormatter.format(row.pv)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                  {numberFormatter.format(row.purchases)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-zinc-950">
                  {formatRate(getPurchaseRate(row))}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                  {yenFormatter.format(row.revenue)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                  {numberFormatter.format(row.masterTransitions)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                  {formatRate(getMasterTransitionRate(row))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComparisonTable({ metrics }: { metrics: ComparisonMetric[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-200 bg-white shadow-sm">
      <SectionHeader title="前期間比較" />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                指標
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                現在値
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                前期間値
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                増減値
              </th>
              <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                増減率
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {metrics.map((metric) => (
              <tr key={metric.label} className="hover:bg-zinc-50">
                <td className="px-5 py-4 font-medium text-zinc-950">
                  {metric.label}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                  {formatMetricValue(metric.current, metric.type)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                  {formatMetricValue(metric.previous, metric.type)}
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium ${getDeltaClass(
                    metric.delta,
                  )}`}
                >
                  {formatDelta(metric.delta, metric.type)}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                  {formatChangeRate(metric.changeRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildKpiCards(totals: MetricTotals, days: number) {
  return [
    {
      label: "売上",
      value: yenFormatter.format(totals.revenue),
      note: "期間内の実売上",
    },
    {
      label: "PV",
      value: numberFormatter.format(totals.pv),
      note: "期間内の日次PV合計",
    },
    {
      label: "購入数",
      value: numberFormatter.format(totals.purchases),
      note: "期間内の購入数合計",
    },
    {
      label: "購入率",
      value: formatRate(getPurchaseRate(totals)),
      note: "購入数 ÷ PV",
    },
    {
      label: "Master遷移数",
      value: numberFormatter.format(totals.masterTransitions),
      note: "期間内の遷移数合計",
    },
    {
      label: "Master遷移率",
      value: formatRate(getMasterTransitionRate(totals)),
      note: "Master遷移数 ÷ 購入数",
    },
    {
      label: "日平均売上",
      value: yenFormatter.format(Math.round(totals.revenue / days)),
      note: "売上 ÷ 選択期間の日数",
    },
  ];
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const resolvedSearchParams = await searchParams;
  const period = resolveAnalyticsPeriod({
    range: getQueryValue(resolvedSearchParams.range),
    from: getQueryValue(resolvedSearchParams.from),
    to: getQueryValue(resolvedSearchParams.to),
  });
  const { currentTotals, previousTotals, dailyRows, articleRows } =
    await getAnalyticsData(period);
  const comparisonMetrics = getComparisonMetrics(currentTotals, previousTotals);
  const kpiCards = buildKpiCards(currentTotals, period.days);
  const topRevenueArticles = getTopArticles(articleRows, "revenue");
  const topPvArticles = getTopArticles(articleRows, "pv");
  const topPurchaseRateArticles = getTopArticlesByPurchaseRate(articleRows);
  const topMasterTransitionArticles = getTopArticles(
    articleRows,
    "masterTransitions",
  );
  const improvementArticles = getImprovementArticles(articleRows);

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
              売上分析
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              日次実績から期間別の売上、PV、購入数、購入率を確認します。
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/metrics/daily"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              日次実績入力
            </Link>
            <Link
              href="/articles"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              記事一覧
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <form
            action="/analytics"
            className="grid gap-4 lg:grid-cols-[14rem_1fr_1fr_auto]"
          >
            <div>
              <label
                htmlFor="range"
                className="block text-sm font-medium text-zinc-700"
              >
                期間
              </label>
              <select
                id="range"
                name="range"
                defaultValue={period.range}
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                {rangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="from"
                className="block text-sm font-medium text-zinc-700"
              >
                開始日
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={period.fromInput}
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <div>
              <label
                htmlFor="to"
                className="block text-sm font-medium text-zinc-700"
              >
                終了日
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={period.toInput}
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <div className="flex flex-col gap-2 lg:justify-end">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              >
                適用
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-zinc-600">
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              対象期間: {period.fromInput} 〜 {period.toInput}
            </span>
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              前期間: {period.previousFromInput} 〜 {period.previousToInput}
            </span>
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              日数: {numberFormatter.format(period.days)}日
            </span>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          {kpiCards.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </section>

        <div className="mb-6">
          <ComparisonTable metrics={comparisonMetrics} />
        </div>

        <div className="mb-6">
          <DailyTable rows={dailyRows} />
        </div>

        <div className="mb-6 grid min-w-0 gap-6 xl:grid-cols-2">
          <RankingTable
            title="売上上位5記事"
            description="選択期間の売上合計で集計"
            articles={topRevenueArticles}
            emptyMessage="選択期間の売上データはありません。"
          />
          <RankingTable
            title="PV上位5記事"
            description="選択期間のPV合計で集計"
            articles={topPvArticles}
            emptyMessage="選択期間のPVデータはありません。"
          />
          <RankingTable
            title="購入率上位5記事"
            description="PV10以上の記事を対象に購入率で集計"
            articles={topPurchaseRateArticles}
            emptyMessage="PV10以上の記事がないため、購入率ランキングは表示できません。"
          />
          <RankingTable
            title="Master遷移数上位5記事"
            description="選択期間のMaster遷移数合計で集計"
            articles={topMasterTransitionArticles}
            emptyMessage="選択期間のMaster遷移データはありません。"
          />
        </div>

        <section className="min-w-0 rounded-lg border border-zinc-200 bg-white shadow-sm">
          <SectionHeader
            title="要改善記事"
            description="PV100以上かつ購入率10%未満。スコアは PV × (10% - 購入率) で算出します。"
          />
          {improvementArticles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      記事タイトル
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      PV
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      購入率
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      売上
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      改善優先度
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {improvementArticles.map((article) => (
                    <tr key={article.articleId} className="hover:bg-zinc-50">
                      <td className="min-w-64 px-5 py-4 font-medium text-zinc-950">
                        <Link
                          href={`/articles/${article.articleId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {article.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(article.pv)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-zinc-950">
                        {formatRate(getPurchaseRate(article))}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {yenFormatter.format(article.revenue)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <span
                          className={
                            article.priority === "高"
                              ? "inline-flex h-8 items-center rounded-full bg-red-50 px-3 text-sm font-semibold text-red-700 ring-1 ring-red-200"
                              : "inline-flex h-8 items-center rounded-full bg-amber-50 px-3 text-sm font-semibold text-amber-700 ring-1 ring-amber-200"
                          }
                        >
                          {article.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="条件に該当する要改善記事はありません。" />
          )}
        </section>
      </div>
    </main>
  );
}
