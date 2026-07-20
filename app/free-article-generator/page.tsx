import Link from "next/link";
import FreeArticleDraftForm from "./FreeArticleDraftForm";
import {
  getFreeArticleGeneratorArticles,
  getRecentFreeArticleDrafts,
} from "@/features/free-article-generator/queries";

export const dynamic = "force-dynamic";

type FreeArticleGeneratorPageProps = {
  searchParams: Promise<{
    articleId?: string;
    category?: string;
  }>;
};

export default async function FreeArticleGeneratorPage({
  searchParams,
}: FreeArticleGeneratorPageProps) {
  const resolvedSearchParams = await searchParams;
  const [articles, recentDrafts] = await Promise.all([
    getFreeArticleGeneratorArticles(),
    getRecentFreeArticleDrafts(),
  ]);
  const defaultArticleId = articles.some(
    (article) => article.id === resolvedSearchParams.articleId,
  )
    ? resolvedSearchParams.articleId
    : "";
  const focusCategory = resolvedSearchParams.category?.trim() ?? "";

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
              Free Article Generator
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
              無料集客記事ジェネレーター
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              送客先Articleから逆算して、無料記事候補を20件生成し、採用した候補だけを完成原稿として保存します。
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
              href="/ai-improvements"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              AI改善
            </Link>
          </div>
        </div>

        {articles.length === 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800 shadow-sm">
            noteUrlが設定された送客先Articleがありません。先に記事一覧から送客先のnoteUrlを登録してください。
          </section>
        ) : (
          <FreeArticleDraftForm
            articles={articles}
            defaultArticleId={defaultArticleId}
            focusCategory={focusCategory}
          />
        )}

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-950">最近の生成記事</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                    タイトル
                  </th>
                  <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                    テーマ
                  </th>
                  <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                    送客先
                  </th>
                  <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {recentDrafts.length > 0 ? (
                  recentDrafts.map((draft) => (
                    <tr key={draft.id}>
                      <td className="px-5 py-4 font-medium text-zinc-950">
                        {draft.title}
                      </td>
                      <td className="px-5 py-4 text-zinc-700">{draft.theme}</td>
                      <td className="px-5 py-4 text-zinc-700">
                        {draft.destinationArticle?.title ?? "送客先未設定"}
                      </td>
                      <td className="px-5 py-4 text-zinc-700">{draft.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-zinc-500">
                      まだ生成記事はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
