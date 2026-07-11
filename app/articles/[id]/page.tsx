import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleAiAnalysisButton from "@/components/articles/ArticleAiAnalysisButton";
import ArticleAiAnalysisReport from "@/components/articles/ArticleAiAnalysisReport";
import ArticleDailyMetricForm from "@/components/articles/ArticleDailyMetricForm";
import ArticleDailyMetricTable from "@/components/articles/ArticleDailyMetricTable";
import { generateArticleAiAnalysisAction } from "@/features/ai/actions";
import {
  getLatestSuccessfulArticleAnalysis,
  toArticleAiAnalysisView,
} from "@/features/ai/queries";
import { upsertArticleDailyMetricAction } from "@/features/metrics/actions";
import { formatTokyoDateInputValue } from "@/features/metrics/calculators";
import { getArticleDailyMetrics } from "@/features/metrics/queries";
import { prisma } from "@/lib/prisma";
import { deleteArticleAction } from "../actions";
import DeleteArticleButton from "./DeleteArticleButton";
import {
  calculatePurchaseRate,
  dateFormatter,
  numberFormatter,
  yenFormatter,
} from "../utils";

type ArticleDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const metricLabels = {
  price: "価格",
  pv: "PV",
  purchases: "購入数",
  purchaseRate: "購入率",
} as const;

export const dynamic = "force-dynamic";

export default async function ArticleDetailPage({
  params,
}: ArticleDetailPageProps) {
  const { id } = await params;
  const [article, dailyMetrics, latestAiAnalysisRun] = await Promise.all([
    prisma.article.findUnique({
      where: { id },
    }),
    getArticleDailyMetrics(id),
    getLatestSuccessfulArticleAnalysis(id),
  ]);

  if (!article) {
    notFound();
  }

  const latestAiAnalysis = toArticleAiAnalysisView(latestAiAnalysisRun);

  const metrics = [
    {
      label: metricLabels.price,
      value: yenFormatter.format(article.price),
    },
    {
      label: metricLabels.pv,
      value: numberFormatter.format(article.pv),
    },
    {
      label: metricLabels.purchases,
      value: numberFormatter.format(article.purchases),
    },
    {
      label: metricLabels.purchaseRate,
      value: `${calculatePurchaseRate(
        article.purchases,
        article.pv,
      ).toFixed(2)}%`,
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/articles"
              className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
            >
              戻る
            </Link>
            <p className="mt-5 text-sm font-medium text-zinc-500">記事詳細</p>
            <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-normal sm:text-3xl">
              {article.title}
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/articles/${article.id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:mt-1"
            >
              編集
            </Link>
            <DeleteArticleButton
              action={deleteArticleAction.bind(null, article.id)}
              articleTitle={article.title}
            />
          </div>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-zinc-500">
                {metric.label}
              </p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-950">
                {metric.value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold">基本情報</h2>
            </div>
            <dl className="divide-y divide-zinc-100">
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-medium text-zinc-500">
                  タイトル
                </dt>
                <dd className="text-sm font-medium text-zinc-950">
                  {article.title}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-medium text-zinc-500">note URL</dt>
                <dd className="text-sm text-zinc-700">
                  {article.noteUrl ? (
                    <a
                      href={article.noteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-zinc-950 underline-offset-4 hover:underline"
                    >
                      {article.noteUrl}
                    </a>
                  ) : (
                    <span className="text-zinc-400">未設定</span>
                  )}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-medium text-zinc-500">更新日</dt>
                <dd className="text-sm tabular-nums text-zinc-700">
                  {dateFormatter.format(new Date(article.updatedAt))}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-medium text-zinc-500">メモ</dt>
                <dd className="text-sm leading-6 text-zinc-700">
                  {article.note}
                </dd>
              </div>
            </dl>
          </div>

          <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">運用メモ</h2>
            <div className="mt-4 space-y-4 text-sm text-zinc-700">
              <p>
                購入率とPVの両方を見ながら、価格変更や導線改善の優先度を判断します。
              </p>
              <div className="rounded-md bg-zinc-100 p-4">
                <p className="font-medium text-zinc-950">次の確認ポイント</p>
                <p className="mt-2 leading-6">
                  更新日が古い記事は、メモを見ながら改善内容を決めていきます。
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">AI改善レポート</h2>
              <p className="mt-1 text-sm text-zinc-500">
                タイトル、価格、累計値、過去30日の日次実績に基づいて改善提案を生成します。
              </p>
            </div>
            <ArticleAiAnalysisButton
              action={generateArticleAiAnalysisAction.bind(null, article.id)}
            />
          </div>

          <ArticleAiAnalysisReport analysis={latestAiAnalysis} />
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-semibold">日次実績</h2>
            <p className="mt-1 text-sm text-zinc-500">
              同じ記事・同じ日付は上書き保存され、累計PVと累計購入数へ同期されます。
            </p>
          </div>

          <div className="border-b border-zinc-200 p-5">
            <ArticleDailyMetricForm
              action={upsertArticleDailyMetricAction.bind(null, article.id)}
              articlePrice={article.price}
              defaultDate={formatTokyoDateInputValue(new Date())}
            />
          </div>

          <ArticleDailyMetricTable metrics={dailyMetrics} />
        </section>
      </div>
    </main>
  );
}
