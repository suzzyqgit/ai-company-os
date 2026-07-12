import Link from "next/link";
import { numberFormatter, yenFormatter } from "@/app/articles/utils";
import { getContentGapAnalysis } from "@/features/content-gap/queries";

export const dynamic = "force-dynamic";

function getPriorityClass(priority: string) {
  if (priority === "高") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (priority === "中") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function getStatusClass(status: string) {
  if (status === "不足") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "十分") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

export default async function ContentGapPage() {
  const { gaps, summary } = await getContentGapAnalysis();

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
            <p className="mt-5 text-sm font-medium text-zinc-500">
              Content Gap Analysis
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
              コンテンツギャップ分析
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              各980円記事について、無料記事から購入前教育までの導線に不足がないかをルールベースで分析します。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/free-article-generator"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              無料記事生成
            </Link>
            <Link
              href="/ai-improvements"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              AI改善
            </Link>
          </div>
        </div>

        <section className="mb-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">不足導線TOP10</p>
            <div className="mt-3 grid gap-1 text-sm text-zinc-700">
              {summary.topMissingCategories.length > 0 ? (
                summary.topMissingCategories.slice(0, 3).map((category) => (
                  <p key={category.category}>
                    {category.category} {numberFormatter.format(category.count)}件
                  </p>
                ))
              ) : (
                <p>不足なし</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">
              優先的に強化すべき商品
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">
              {numberFormatter.format(
                summary.priorityProducts.filter((product) => product.priority === "高").length,
              )}
              件
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">
              無料記事不足ランキング
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">
              {summary.freeArticleShortageRanking[0]?.missingCategories.length ?? 0}
              カテゴリ
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">期待売上インパクト</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">
              {yenFormatter.format(summary.expectedRevenueImpact)}
            </p>
          </div>
        </section>

        {gaps.length === 0 ? (
          <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">
            分析対象の980円記事がありません。
          </section>
        ) : (
          <section className="grid gap-5">
            {gaps
              .sort((left, right) => right.expectedImpact - left.expectedImpact)
              .map((gap) => {
                const primaryMissingCategory = gap.missingCategories[0] ?? "認知";

                return (
                  <article
                    key={gap.articleId}
                    className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${getPriorityClass(
                              gap.priority,
                            )}`}
                          >
                            改善優先度 {gap.priority}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                            無料記事数 {numberFormatter.format(gap.freeArticleCount)}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                            期待効果 {yenFormatter.format(gap.expectedImpact)}
                          </span>
                        </div>
                        <h2 className="mt-3 text-lg font-bold text-zinc-950">
                          {gap.title}
                        </h2>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
                          <span className="rounded-md bg-zinc-100 px-2 py-1">
                            価格 {yenFormatter.format(gap.price)}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-1">
                            PV {numberFormatter.format(gap.pv)}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-1">
                            購入率 {gap.conversionRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/free-article-generator?articleId=${gap.articleId}&category=${encodeURIComponent(
                          primaryMissingCategory,
                        )}`}
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                      >
                        記事を生成
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                      <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                        <h3 className="text-sm font-semibold text-zinc-950">
                          導線カテゴリ
                        </h3>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {gap.categories.map((category) => (
                            <div
                              key={category.category}
                              className="rounded-md border border-zinc-200 bg-white p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-zinc-950">
                                  {category.category}
                                </p>
                                <span
                                  className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${getStatusClass(
                                    category.status,
                                  )}`}
                                >
                                  {category.status}
                                </span>
                              </div>
                              <p className="mt-2 text-sm tabular-nums text-zinc-600">
                                {category.stars} / {category.score}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                        <h3 className="text-sm font-semibold text-zinc-950">
                          AI改善連携メモ
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-700">
                          {gap.aiImprovementHint}
                        </p>
                        <h3 className="mt-5 text-sm font-semibold text-zinc-950">
                          不足カテゴリ
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-700">
                          {gap.missingCategories.length > 0
                            ? gap.missingCategories.join(" / ")
                            : "不足カテゴリはありません。"}
                        </p>
                        <h3 className="mt-5 text-sm font-semibold text-zinc-950">
                          おすすめ記事テーマ
                        </h3>
                        <ul className="mt-2 grid gap-2 text-sm leading-6 text-zinc-700">
                          {gap.recommendedThemes.length > 0 ? (
                            gap.recommendedThemes.map((theme) => (
                              <li key={theme}>・{theme}</li>
                            ))
                          ) : (
                            <li>・既存無料記事のCTA改善を優先</li>
                          )}
                        </ul>
                        <p className="mt-5 rounded-md bg-white p-3 text-sm leading-6 text-zinc-700">
                          {gap.expectedEffect}
                        </p>
                      </section>
                    </div>
                  </article>
                );
              })}
          </section>
        )}
      </div>
    </main>
  );
}
