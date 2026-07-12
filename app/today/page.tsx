import Link from "next/link";
import type { ReactNode } from "react";
import { dateFormatter, numberFormatter, yenFormatter } from "@/app/articles/utils";
import { getTodayData } from "@/features/today/queries";
import TodayChecklist from "./TodayChecklist";

export const dynamic = "force-dynamic";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-zinc-950">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-zinc-500">{message}</p>;
}

export default async function TodayPage() {
  const {
    primaryTask,
    checklistItems,
    improvementArticle,
    freeArticlePlan,
    todayKpis,
    recentUpdates,
  } = await getTodayData();

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Sprint 1</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">Today</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              今日やるべき改善、作る記事、確認すべき数字を一画面にまとめます。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              Dashboard
            </Link>
            <Link
              href="/content-gap"
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              Gap分析
            </Link>
            <Link
              href="/free-article-generator"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              記事生成
            </Link>
          </div>
        </div>

        <section className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-zinc-300">今日の最重要タスク</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-normal">
                {primaryTask.title}
              </h2>
              <dl className="mt-4 grid gap-3 text-sm leading-6 text-zinc-200">
                <div>
                  <dt className="font-semibold text-white">理由</dt>
                  <dd>{primaryTask.reason}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">期待効果</dt>
                  <dd>{primaryTask.expectedEffect}</dd>
                </div>
              </dl>
            </div>
            <Link
              href={primaryTask.href}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-100"
            >
              {primaryTask.buttonLabel}
            </Link>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
          <Section title="今日やること">
            <TodayChecklist items={checklistItems} />
          </Section>

          <Section title="今日のKPI">
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiCard label="今日売上" value={yenFormatter.format(todayKpis.todayRevenue)} />
              <KpiCard label="今日PV" value={numberFormatter.format(todayKpis.todayPv)} />
              <KpiCard
                label="今日購入数"
                value={`${numberFormatter.format(todayKpis.todayPurchases)} 件`}
              />
              <KpiCard label="今週売上" value={yenFormatter.format(todayKpis.weekRevenue)} />
              <KpiCard
                label="今週購入数"
                value={`${numberFormatter.format(todayKpis.weekPurchases)} 件`}
              />
              <KpiCard
                label="目標まで"
                value={`あと${numberFormatter.format(
                  todayKpis.remainingPurchasesToGoal,
                )}件`}
              />
            </div>
          </Section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="今日改善する980円記事">
            {improvementArticle ? (
              <div className="grid gap-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-950">
                    {improvementArticle.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
                    <span className="rounded-md bg-zinc-100 px-2 py-1">
                      PV {numberFormatter.format(improvementArticle.pv)}
                    </span>
                    <span className="rounded-md bg-zinc-100 px-2 py-1">
                      購入率 {improvementArticle.conversionRate.toFixed(1)}%
                    </span>
                    <span className="rounded-md bg-zinc-100 px-2 py-1">
                      価格 {yenFormatter.format(improvementArticle.price)}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-6 text-zinc-700">
                  {improvementArticle.reason}
                </p>
                <Link
                  href="/ai-improvements"
                  className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                >
                  改善する
                </Link>
              </div>
            ) : (
              <EmptyState message="改善対象の記事がまだありません。" />
            )}
          </Section>

          <Section title="今日作る無料記事">
            {freeArticlePlan ? (
              <div className="grid gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500">送客先Article</p>
                  <h3 className="mt-1 text-lg font-bold text-zinc-950">
                    {freeArticlePlan.destinationArticleTitle}
                  </h3>
                </div>
                <div className="grid gap-3 text-sm text-zinc-700">
                  <p>
                    <span className="font-semibold text-zinc-950">不足カテゴリ:</span>{" "}
                    {freeArticlePlan.missingCategory}
                  </p>
                  <p>
                    <span className="font-semibold text-zinc-950">おすすめテーマ:</span>{" "}
                    {freeArticlePlan.recommendedTheme}
                  </p>
                </div>
                <Link
                  href={freeArticlePlan.href}
                  className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                >
                  記事生成
                </Link>
              </div>
            ) : (
              <EmptyState message="Content Gapから生成候補を取得できませんでした。" />
            )}
          </Section>
        </div>

        <Section title="最近の更新">
          {recentUpdates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                      種別
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                      内容
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                      更新日時
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {recentUpdates.map((update) => (
                    <tr key={update.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                        {update.type}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <Link
                          href={update.href}
                          className="underline-offset-4 hover:underline"
                        >
                          {update.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {dateFormatter.format(update.at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="最近の更新はまだありません。" />
          )}
        </Section>
      </div>
    </main>
  );
}
