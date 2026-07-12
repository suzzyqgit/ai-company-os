import Link from "next/link";
import {
  calculatePurchaseRate,
  dateFormatter,
  numberFormatter,
  yenFormatter,
} from "@/app/articles/utils";
import { getTodayAiImprovements } from "@/features/ai-improvements/queries";
import type { AiImprovementPriority } from "@/features/ai-improvements/rules";

export const dynamic = "force-dynamic";

function getPriorityClass(priority: AiImprovementPriority) {
  if (priority === "high") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (priority === "medium") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function getPriorityIcon(priority: AiImprovementPriority) {
  if (priority === "high") {
    return "🔴";
  }

  if (priority === "medium") {
    return "🟡";
  }

  return "🟢";
}

export default async function AiImprovementsPage() {
  const improvements = await getTodayAiImprovements();
  const totalPv = improvements.reduce((total, article) => total + article.pv, 0);
  const totalPurchases = improvements.reduce(
    (total, article) => total + article.purchases,
    0,
  );
  const averageConversionRate = calculatePurchaseRate(totalPurchases, totalPv);

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
            <p className="mt-5 text-sm font-medium text-zinc-500">AI改善</p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
              今日改善すべき記事 TOP10
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              PV、購入数、購入率、価格、更新日から、今日売上改善につながりやすい記事をルールベースで提案します。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/articles"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              記事一覧
            </Link>
            <Link
              href="/analytics"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              売上管理
            </Link>
          </div>
        </div>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">対象記事</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">
              {numberFormatter.format(improvements.length)} 件
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">TOP10合計PV</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">
              {numberFormatter.format(totalPv)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">平均購入率</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">
              {averageConversionRate.toFixed(1)}%
            </p>
          </div>
        </section>

        <section className="grid gap-5">
          {improvements.length > 0 ? (
            improvements.map((improvement, index) => (
              <article
                key={improvement.articleId}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-500">
                        #{index + 1}
                      </span>
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${getPriorityClass(
                          improvement.priority,
                        )}`}
                      >
                        {getPriorityIcon(improvement.priority)} 優先度
                        {improvement.priorityLabel}
                      </span>
                      <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                        スコア {improvement.score}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-bold text-zinc-950">
                      {improvement.title}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
                      <span className="rounded-md bg-zinc-100 px-2 py-1">
                        PV {numberFormatter.format(improvement.pv)}
                      </span>
                      <span className="rounded-md bg-zinc-100 px-2 py-1">
                        購入 {numberFormatter.format(improvement.purchases)}
                      </span>
                      <span className="rounded-md bg-zinc-100 px-2 py-1">
                        購入率 {improvement.conversionRate.toFixed(1)}%
                      </span>
                      <span className="rounded-md bg-zinc-100 px-2 py-1">
                        価格 {yenFormatter.format(improvement.price)}
                      </span>
                      <span className="rounded-md bg-zinc-100 px-2 py-1">
                        更新日 {dateFormatter.format(improvement.updatedAt)}
                      </span>
                      <span className="rounded-md bg-zinc-100 px-2 py-1">
                        {improvement.recentlyUpdated ? "直近更新あり" : "直近更新なし"}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/articles/${improvement.articleId}`}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                  >
                    記事を開く
                  </Link>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-950">改善理由</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {improvement.improvementReason}
                    </p>
                  </section>

                  <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-950">
                      タイトル改善案
                    </h3>
                    <ul className="mt-2 grid gap-2 text-sm leading-6 text-zinc-700">
                      {improvement.titleIdeas.map((idea) => (
                        <li key={idea}>・{idea}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-950">
                      無料部分改善案
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {improvement.freePreviewSuggestion}
                    </p>
                  </section>

                  <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-950">CTA改善案</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {improvement.ctaSuggestion}
                    </p>
                  </section>

                  <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-950">
                      価格変更提案
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {improvement.priceSuggestion}
                    </p>
                  </section>

                  <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-950">
                      関連記事への導線提案
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {improvement.relatedArticleSuggestion}
                    </p>
                  </section>
                </div>

                <div className="mt-4 grid gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-500">リライト優先度</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-950">
                      {improvement.rewritePriority}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500">期待効果</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">
                      {improvement.expectedEffect}
                    </p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 shadow-sm">
              改善対象の記事がありません。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
