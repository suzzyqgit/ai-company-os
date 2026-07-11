import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { numberFormatter } from "../articles/utils";
import ProductionMigrationForm from "./ProductionMigrationForm";

export const dynamic = "force-dynamic";

type ProductionMigrationPageProps = {
  searchParams: Promise<{
    deleted?: string | string[];
  }>;
};

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function ProductionMigrationPage({
  searchParams,
}: ProductionMigrationPageProps) {
  const resolvedSearchParams = await searchParams;
  const deletedCount = Number(getQueryValue(resolvedSearchParams.deleted));
  const hasDeletedMessage = Number.isInteger(deletedCount) && deletedCount >= 0;

  const targets = await prisma.article.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      pv: true,
      purchases: true,
      _count: {
        select: {
          dailyMetrics: true,
          aiAnalysisRuns: true,
        },
      },
    },
  });

  const hasTargets = targets.length > 0;
  const hasRelatedData = targets.some(
    (target) =>
      target._count.dailyMetrics > 0 || target._count.aiAnalysisRuns > 0,
  );
  const dailyMetricCount = targets.reduce(
    (total, target) => total + target._count.dailyMetrics,
    0,
  );
  const aiAnalysisCount = targets.reduce(
    (total, target) => total + target._count.aiAnalysisRuns,
    0,
  );

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              Dashboardへ戻る
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-normal sm:text-3xl">
              実運用へ移行
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              デモ用に登録した記事を削除し、実際のnote記事だけで運用を始めるための確認画面です。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-zinc-500">削除対象</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {numberFormatter.format(targets.length)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-zinc-500">日次実績</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {numberFormatter.format(dailyMetricCount)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-zinc-500">AI分析</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {numberFormatter.format(aiAnalysisCount)}
              </p>
            </div>
          </div>
        </div>

        {hasDeletedMessage ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            実運用へ移行しました。削除件数:{" "}
            {numberFormatter.format(deletedCount)} 件
          </div>
        ) : null}

        {hasRelatedData ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
            削除対象の記事には日次実績またはAI分析が紐付いています。実行すると関連データも削除されます。
          </div>
        ) : null}

        <section className="mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-950">
              削除対象一覧
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              現在DBに存在する記事を表示しています。
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="w-[28rem] px-5 py-3 text-left font-semibold text-zinc-700">
                    タイトル
                  </th>
                  <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                    PV
                  </th>
                  <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                    購入数
                  </th>
                  <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                    日次実績件数
                  </th>
                  <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                    AI分析件数
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {targets.length > 0 ? (
                  targets.map((target) => (
                    <tr key={target.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-4 font-medium text-zinc-950">
                        {target.title}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(target.pv)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(target.purchases)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(target._count.dailyMetrics)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(target._count.aiAnalysisRuns)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-zinc-500"
                    >
                      削除対象の記事はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ProductionMigrationForm
          hasTargets={hasTargets}
          hasRelatedData={hasRelatedData}
        />
      </div>
    </main>
  );
}
