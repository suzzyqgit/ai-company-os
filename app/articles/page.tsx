import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculatePurchaseRate,
  dateFormatter,
  numberFormatter,
  yenFormatter,
} from "./utils";

export const dynamic = "force-dynamic";

type ArticlesPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
    order?: string | string[];
  }>;
};

type SortKey =
  | "updatedAt"
  | "pv"
  | "purchases"
  | "conversionRate"
  | "price"
  | "title";

type SortOrder = "asc" | "desc";

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "updatedAt", label: "更新日" },
  { value: "pv", label: "PV" },
  { value: "purchases", label: "購入数" },
  { value: "conversionRate", label: "購入率" },
  { value: "price", label: "価格" },
  { value: "title", label: "タイトル" },
];

const orderOptions: Array<{ value: SortOrder; label: string }> = [
  { value: "desc", label: "新しい / 多い / 高い / 降順" },
  { value: "asc", label: "古い / 少ない / 低い / 昇順" },
];

const prismaSortFields = {
  updatedAt: "updatedAt",
  pv: "pv",
  purchases: "purchases",
  price: "price",
  title: "title",
} satisfies Partial<Record<SortKey, keyof Prisma.ArticleOrderByWithRelationInput>>;

const sortLabels: Record<SortKey, string> = {
  updatedAt: "更新日",
  pv: "PV",
  purchases: "購入数",
  conversionRate: "購入率",
  price: "価格",
  title: "タイトル",
};

const orderLabels: Record<SortKey, Record<SortOrder, string>> = {
  updatedAt: {
    desc: "新しい順",
    asc: "古い順",
  },
  pv: {
    desc: "多い順",
    asc: "少ない順",
  },
  purchases: {
    desc: "多い順",
    asc: "少ない順",
  },
  conversionRate: {
    desc: "高い順",
    asc: "低い順",
  },
  price: {
    desc: "高い順",
    asc: "低い順",
  },
  title: {
    desc: "降順",
    asc: "昇順",
  },
};

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeSort(value: string): SortKey {
  return sortOptions.some((option) => option.value === value)
    ? (value as SortKey)
    : "updatedAt";
}

function normalizeOrder(value: string): SortOrder {
  return value === "asc" || value === "desc" ? value : "desc";
}

function buildArticlesHref(params: {
  q?: string;
  sort: SortKey;
  order: SortOrder;
}) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }

  if (params.sort !== "updatedAt" || params.order !== "desc") {
    searchParams.set("sort", params.sort);
    searchParams.set("order", params.order);
  }

  const query = searchParams.toString();
  return query ? `/articles?${query}` : "/articles";
}

function sortByConversionRate<T extends { purchases: number; pv: number; title: string; updatedAt: Date }>(
  articles: T[],
  order: SortOrder,
) {
  const direction = order === "desc" ? -1 : 1;

  return [...articles].sort((a, b) => {
    const rateA = calculatePurchaseRate(a.purchases, a.pv);
    const rateB = calculatePurchaseRate(b.purchases, b.pv);

    if (rateA !== rateB) {
      return (rateA - rateB) * direction;
    }

    if (a.updatedAt.getTime() !== b.updatedAt.getTime()) {
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }

    return a.title.localeCompare(b.title, "ja");
  });
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = getQueryValue(resolvedSearchParams.q).trim();
  const sort = normalizeSort(getQueryValue(resolvedSearchParams.sort));
  const order = normalizeOrder(getQueryValue(resolvedSearchParams.order));

  const where: Prisma.ArticleWhereInput = query
    ? {
        title: {
          contains: query,
        },
      }
    : {};

  const orderBy: Prisma.ArticleOrderByWithRelationInput =
    sort === "conversionRate"
      ? { updatedAt: "desc" }
      : { [prismaSortFields[sort]]: order };

  const fetchedArticles = await prisma.article.findMany({
    where,
    orderBy,
  });

  const articles =
    sort === "conversionRate"
      ? sortByConversionRate(fetchedArticles, order)
      : fetchedArticles;

  const clearSearchHref = buildArticlesHref({
    sort,
    order,
  });

  const isFiltered = query !== "";
  const conditionText = `${sortLabels[sort]} ${orderLabels[sort][order]}`;

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
              {isFiltered ? "検索結果" : "登録記事"} {articles.length} 件
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <form
            action="/articles"
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem_14rem_auto]"
          >
            <div>
              <label
                htmlFor="q"
                className="block text-sm font-medium text-zinc-700"
              >
                タイトル検索
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="記事タイトルで検索"
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <div>
              <label
                htmlFor="sort"
                className="block text-sm font-medium text-zinc-700"
              >
                並び替え項目
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort}
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="order"
                className="block text-sm font-medium text-zinc-700"
              >
                並び順
              </label>
              <select
                id="order"
                name="order"
                defaultValue={order}
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                {orderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 lg:justify-end">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
              >
                適用
              </button>
              {isFiltered ? (
                <Link
                  href={clearSearchHref}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                >
                  検索解除
                </Link>
              ) : null}
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-zinc-600">
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              検索: {query || "指定なし"}
            </span>
            <span className="rounded-md bg-zinc-100 px-3 py-1">
              並び替え: {conditionText}
            </span>
          </div>
        </section>

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
                {articles.length > 0 ? (
                  articles.map((article) => (
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
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-zinc-500"
                    >
                      該当する記事はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
