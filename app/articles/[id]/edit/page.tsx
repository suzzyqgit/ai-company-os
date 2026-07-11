import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateArticleAction } from "@/app/articles/actions";
import ArticleForm from "../../ArticleForm";
import { formatDateInputValue } from "../../utils";

type ArticleEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ArticleEditPage({ params }: ArticleEditPageProps) {
  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
  });

  if (!article) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <Link
            href={`/articles/${article.id}`}
            className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
          >
            戻る
          </Link>
          <p className="mt-5 text-sm font-medium text-zinc-500">記事編集</p>
          <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-normal sm:text-3xl">
            {article.title}
          </h1>
        </div>

        <ArticleForm
          action={updateArticleAction.bind(null, article.id)}
          cancelHref={`/articles/${article.id}`}
          formTitle="編集内容"
          initialValues={{
            title: article.title,
            noteUrl: article.noteUrl,
            price: String(article.price),
            pv: String(article.pv),
            purchases: String(article.purchases),
            updatedAt: formatDateInputValue(article.updatedAt),
            memo: article.note,
          }}
        />
      </div>
    </main>
  );
}
