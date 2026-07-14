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
  const importUpdates = recentUpdates.filter((update) =>
    ["OCR", "CSV", "公開記事同期"].includes(update.type),
  );

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Today</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">Today</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              今日のKPI、やること、改善記事、公開する無料記事、必要な取込に集中します。
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
              href="/imports"
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              データ取込
            </Link>
            <Link
              href="/free-articles"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              無料記事
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
                  <p>
                    <span className="font-semibold text-zinc-950">パイプライン:</span>{" "}
                    {freeArticlePlan.pipelineStatus ?? "未作成"}
                  </p>
                </div>
                <Link
                  href={freeArticlePlan.href}
                  className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                >
                  {freeArticlePlan.actionLabel}
                </Link>
              </div>
            ) : (
              <EmptyState message="Content Gapから生成候補を取得できませんでした。" />
            )}
          </Section>
        </div>

        <Section title="今日必要な取込">
          {importUpdates.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {importUpdates.map((update) => (
                <Link
                  key={update.id}
                  href={update.href}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition hover:bg-zinc-100"
                >
                  <p className="text-xs font-semibold text-zinc-500">
                    {update.type}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-950">
                    {update.title}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    最終更新 {dateFormatter.format(update.at)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <Link
                href="/imports/note-access"
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
              >
                noteアクセスOCRを取り込む
              </Link>
              <Link
                href="/imports/note-sales"
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
              >
                販売履歴CSVを取り込む
              </Link>
              <Link
                href="/imports/note-profile"
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
              >
                公開記事URLを同期する
              </Link>
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}
