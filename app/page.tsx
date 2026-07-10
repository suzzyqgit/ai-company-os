import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  calculatePurchaseRate,
  dateFormatter,
  numberFormatter,
  yenFormatter,
} from "./articles/utils";

export const dynamic = "force-dynamic";

type DashboardArticle = {
  id: string;
  title: string;
  price: number;
  pv: number;
  purchases: number;
  updatedAt: Date;
};

const quickActions = [
  { label: "記事一覧", href: "/articles", isDisabled: false },
  { label: "記事追加", href: "/articles/new", isDisabled: false },
  { label: "売上管理", href: "/analytics", isDisabled: false },
  { label: "AI改善", href: "#", isDisabled: true },
];

function getEstimatedRevenue(articles: DashboardArticle[]) {
  return articles.reduce(
    (total, article) => total + article.price * article.purchases,
    0,
  );
}

function getAveragePrice(articles: DashboardArticle[]) {
  if (articles.length === 0) {
    return 0;
  }

  const totalPrice = articles.reduce((total, article) => total + article.price, 0);
  return Math.round(totalPrice / articles.length);
}

function getPriority(purchaseRate: number) {
  return purchaseRate < 5 ? "高" : "中";
}

function getPriorityClass(priority: string) {
  return priority === "高"
    ? "bg-red-50 text-red-700 ring-red-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";
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

export default async function Home() {
  const articles = await prisma.article.findMany({
    orderBy: {
      updatedAt: "desc",
    },
  });

  const totalArticles = articles.length;
  const totalPv = articles.reduce((total, article) => total + article.pv, 0);
  const totalPurchases = articles.reduce(
    (total, article) => total + article.purchases,
    0,
  );
  const estimatedRevenue = getEstimatedRevenue(articles);
  const averagePurchaseRate = calculatePurchaseRate(totalPurchases, totalPv);
  const averagePrice = getAveragePrice(articles);

  const winningArticles = [...articles]
    .sort((a, b) => {
      const rateA = calculatePurchaseRate(a.purchases, a.pv);
      const rateB = calculatePurchaseRate(b.purchases, b.pv);

      if (rateA !== rateB) {
        return rateB - rateA;
      }

      return b.pv - a.pv;
    })
    .slice(0, 5);

  const improvementArticles = articles
    .map((article) => ({
      ...article,
      purchaseRate: calculatePurchaseRate(article.purchases, article.pv),
    }))
    .filter((article) => article.pv >= 100 && article.purchaseRate < 10)
    .sort((a, b) => {
      if (a.purchaseRate !== b.purchaseRate) {
        return a.purchaseRate - b.purchaseRate;
      }

      return b.pv - a.pv;
    });

  const recentArticles = articles.slice(0, 5);

  const kpiCards = [
    {
      label: "総記事数",
      value: `${numberFormatter.format(totalArticles)} 件`,
      note: "現在登録されている記事",
    },
    {
      label: "総PV",
      value: numberFormatter.format(totalPv),
      note: "全記事の合計PV",
    },
    {
      label: "総購入数",
      value: numberFormatter.format(totalPurchases),
      note: "全記事の購入数合計",
    },
    {
      label: "推定売上",
      value: yenFormatter.format(estimatedRevenue),
      note: "価格 × 購入数",
    },
    {
      label: "平均購入率",
      value: `${averagePurchaseRate.toFixed(2)}%`,
      note: "総購入数 ÷ 総PV",
    },
    {
      label: "平均記事単価",
      value: yenFormatter.format(averagePrice),
      note: "記事価格の平均",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Dashboard</p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
              今日の改善ダッシュボード
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              記事の成果をまとめて確認し、購入率とPVから今日の改善優先度を判断します。
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[36rem]">
            {quickActions.map((action) =>
              action.isDisabled ? (
                <span
                  key={action.label}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 px-4 text-sm font-semibold text-zinc-400"
                >
                  {action.label}
                </span>
              ) : (
                <Link
                  key={action.label}
                  href={action.href}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                >
                  {action.label}
                </Link>
              ),
            )}
          </div>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-zinc-500">{card.label}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-950">
                {card.value}
              </p>
              <p className="mt-2 text-xs text-zinc-500">{card.note}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <SectionHeader
              title="勝ち記事"
              description="購入率が高い記事の上位5件"
            />
            {winningArticles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                        タイトル
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        購入率
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        PV
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        購入数
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {winningArticles.map((article) => (
                      <tr key={article.id} className="hover:bg-zinc-50">
                        <td className="px-5 py-4 font-medium text-zinc-950">
                          <Link
                            href={`/articles/${article.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {article.title}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-semibold text-zinc-950">
                          {calculatePurchaseRate(
                            article.purchases,
                            article.pv,
                          ).toFixed(2)}
                          %
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                          {numberFormatter.format(article.pv)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                          {numberFormatter.format(article.purchases)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="まだ記事が登録されていません。" />
            )}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <SectionHeader
              title="要改善記事"
              description="PV100以上かつ購入率10%未満"
            />
            {improvementArticles.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {improvementArticles.map((article) => {
                  const priority = getPriority(article.purchaseRate);

                  return (
                    <Link
                      key={article.id}
                      href={`/articles/${article.id}`}
                      className="grid gap-3 px-5 py-4 transition hover:bg-zinc-50 sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="font-medium text-zinc-950">
                          {article.title}
                        </p>
                        <p className="mt-2 text-sm tabular-nums text-zinc-600">
                          PV {numberFormatter.format(article.pv)} / 購入率{" "}
                          {article.purchaseRate.toFixed(2)}%
                        </p>
                      </div>
                      <div className="flex items-center sm:justify-end">
                        <span
                          className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold ring-1 ${getPriorityClass(
                            priority,
                          )}`}
                        >
                          優先度 {priority}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="条件に該当する要改善記事はありません。" />
            )}
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white shadow-sm">
          <SectionHeader title="最近更新した記事" />
          {recentArticles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      タイトル
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      PV
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      購入数
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      更新日
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recentArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-4 font-medium text-zinc-950">
                        <Link
                          href={`/articles/${article.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {article.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(article.pv)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(article.purchases)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                        {dateFormatter.format(article.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="まだ記事が登録されていません。" />
          )}
        </section>
      </div>
    </main>
  );
}
