import Link from "next/link";
import { initializeProductMasterFoundationAction } from "./actions";
import { getProductMasterFoundationData } from "@/features/product-master/queries";

export const dynamic = "force-dynamic";

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function formatNumber(value: number) {
  return value.toLocaleString("ja-JP");
}

function formatPrices(prices: number[]) {
  return prices.map((price) => yenFormatter.format(price)).join(" / ");
}

function shortId(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

type ProductMasterPageProps = {
  searchParams: Promise<{
    initialized?: string;
    products?: string;
    articles?: string;
    records?: string;
  }>;
};

export default async function ProductMasterPage({
  searchParams,
}: ProductMasterPageProps) {
  const params = await searchParams;
  const {
    manifest,
    productCount,
    articleCount,
    candidateProductCount,
    candidateArticleCount,
    isInitialized,
  } = await getProductMasterFoundationData();
  const previewItems = manifest.items.slice(0, 20);
  const initializationSummary =
    params.initialized === "1"
      ? `${formatNumber(Number(params.products ?? 0))} Products / ${formatNumber(
          Number(params.articles ?? 0),
        )} Articles / ${formatNumber(Number(params.records ?? 0))} CanonicalSalesRecords updated.`
      : null;

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Case No.004</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">
              Product Master Foundation
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              CanonicalSalesRecordから、販売実績がある商品単位だけをProductとArticleへ
              冪等に初期化します。Sale / SaleItem / PromotionRunと承認状態は変更しません。
            </p>
          </div>
          <Link
            href="/executive"
            className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50"
          >
            Executive
          </Link>
        </div>

        {initializationSummary ? (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            Product Master initialization completed: {initializationSummary}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Manifest Products", manifest.productCount],
            ["Manifest Articles", manifest.articleCount],
            ["Canonical Records", manifest.canonicalRecordCount],
            ["Gross Amount", yenFormatter.format(manifest.grossAmount)],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-zinc-500">{label}</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-zinc-950">
                {typeof value === "number" ? formatNumber(value) : value}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">
              Initialization Gate
            </h2>
            <dl className="mt-4 grid gap-3 text-sm leading-6">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-zinc-950">Current Products</dt>
                <dd className="text-zinc-700">{formatNumber(productCount)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-zinc-950">Current Articles</dt>
                <dd className="text-zinc-700">{formatNumber(articleCount)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-zinc-950">
                  Product-resolved Records
                </dt>
                <dd className="text-zinc-700">
                  {formatNumber(candidateProductCount)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-zinc-950">
                  Article-resolved Records
                </dt>
                <dd className="text-zinc-700">
                  {formatNumber(candidateArticleCount)}
                </dd>
              </div>
            </dl>
            <form action={initializeProductMasterFoundationAction} className="mt-5">
              <button
                type="submit"
                disabled={manifest.productCount === 0}
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {isInitialized ? "Reconcile Product Master" : "Initialize Product Master"}
              </button>
            </form>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Deterministic IDs are derived from normalized product names. Re-running updates
              the same Product and Article records instead of creating duplicates.
            </p>
          </article>

          <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">
              Manifest Evidence
            </h2>
            <dl className="mt-4 grid gap-3 text-sm leading-6">
              <div>
                <dt className="font-semibold text-zinc-950">Fingerprint</dt>
                <dd className="mt-1 break-all text-zinc-700">
                  {manifest.manifestFingerprint}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-zinc-950">Net Amount</dt>
                <dd className="text-zinc-700">
                  {yenFormatter.format(manifest.netAmount)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-950">Mapping Rule</dt>
                <dd className="mt-1 text-zinc-700">
                  One sold normalized product title becomes one Product and one Article.
                  Series and normalized-title collisions are not merged automatically.
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-950">
              Product Manifest Preview
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Preview shows the first 20 of {formatNumber(manifest.productCount)} deterministic
              Product candidates.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-zinc-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Records</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Observed Prices</th>
                  <th className="px-4 py-3">Product ID</th>
                  <th className="px-4 py-3">Article ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {previewItems.map((item) => (
                  <tr key={item.productId}>
                    <td className="max-w-md px-4 py-3">
                      <p className="font-medium text-zinc-950">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {item.normalizedProductName}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">
                      {formatNumber(item.canonicalRecordCount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">
                      {yenFormatter.format(item.grossAmount)}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {formatPrices(item.observedUnitPrices)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {shortId(item.productId)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {shortId(item.articleId)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
