import Link from "next/link";
import NoteProfileImportForm from "./NoteProfileImportForm";

export default function NoteProfileImportPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              Dashboardへ戻る
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-normal sm:text-3xl">
              note公開記事URL同期
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              noteプロフィールの公開記事一覧からタイトルとURLを取得し、既存ArticleへnoteUrlを登録します。Article未登録の無料記事も確認後に作成できます。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              href="/articles"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              記事一覧
            </Link>
            <Link
              href="/imports/note-sales"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              販売履歴CSV
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <NoteProfileImportForm />
      </div>
    </main>
  );
}
