import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  calculatePurchaseRate,
  dateFormatter,
  numberFormatter,
  yenFormatter,
} from "./utils";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const articles = await prisma.article.findMany({
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              メニューへ戻る
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-normal sm:text-3xl">
              記事一覧
            </h1>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Link
              href="/articles/new"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              記事を追加
            </Link>
            <p className="text-sm text-zinc-500">
              ダミーデータ {articles.length} 件
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  <th
                    scope="col"
                    className="w-[34rem] px-5 py-3 text-left font-semibold text-zinc-700"
                  >
                    タイトル
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-semibold text-zinc-700"
                  >
                    価格
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-semibold text-zinc-700"
                  >
                    PV
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-semibold text-zinc-700"
                  >
                    購入数
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-semibold text-zinc-700"
                  >
                    購入率
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-semibold text-zinc-700"
                  >
                    更新日
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {articles.map((article) => (
                  <tr
                    key={article.id}
                    className="transition hover:bg-zinc-50"
                  >
                    <td className="px-5 py-4 font-medium text-zinc-950">
                      <Link
                        href={`/articles/${article.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {yenFormatter.format(article.price)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {numberFormatter.format(article.pv)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {numberFormatter.format(article.purchases)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-zinc-950">
                      {calculatePurchaseRate(
                        article.purchases,
                        article.pv,
                      ).toFixed(2)}
                      %
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                      {dateFormatter.format(new Date(article.updatedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
