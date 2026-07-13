import Link from "next/link";
import { getFreeArticlePipelineData } from "@/features/free-articles/queries";
import FreeArticlePipelineCards from "./FreeArticlePipelineCards";

export const dynamic = "force-dynamic";

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">
        {value.toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

export default async function FreeArticlesPage() {
  const { items, kpis } = await getFreeArticlePipelineData();

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              Dashboardへ戻る
            </Link>
            <p className="mt-5 text-sm font-medium text-zinc-500">
              無料記事パイプライン
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">
              Free Articles
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              企画、下書き、レビュー、公開、改善までを一画面で管理します。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/free-article-generator"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              記事を生成
            </Link>
            <Link
              href="/content-gap"
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              Gap分析
            </Link>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Idea数" value={kpis.ideaCount} />
          <KpiCard label="Draft数" value={kpis.draftCount} />
          <KpiCard label="Review待ち" value={kpis.reviewCount} />
          <KpiCard label="公開待ち" value={kpis.readyCount} />
          <KpiCard label="公開済み" value={kpis.publishedCount} />
        </section>

        <FreeArticlePipelineCards items={items} />
      </div>
    </main>
  );
}
