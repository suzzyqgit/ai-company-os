import Link from "next/link";
import { createArticleAction } from "@/app/articles/actions";
import ArticleForm from "../ArticleForm";

export default function NewArticlePage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <Link
            href="/articles"
            className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            戻る
          </Link>
          <p className="mt-5 text-sm font-medium text-zinc-500">記事追加</p>
          <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-normal sm:text-3xl">
            新しい記事
          </h1>
        </div>

        <ArticleForm
          action={createArticleAction}
          cancelHref="/articles"
          formTitle="記事情報"
          initialValues={{
            title: "",
            noteUrl: "",
            price: "",
            pv: "",
            purchases: "",
            updatedAt: "",
            memo: "",
          }}
        />
      </div>
    </main>
  );
}
