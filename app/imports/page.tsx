import Link from "next/link";

export const dynamic = "force-dynamic";

const importRoutes = [
  {
    title: "noteアクセスOCR",
    description: "アクセス状況スクリーンショットから記事PVを取り込みます。",
    href: "/imports/note-access",
    timing: "PV確認時",
  },
  {
    title: "販売履歴CSV",
    description: "noteの販売履歴CSVから購入数と売上を取り込みます。",
    href: "/imports/note-sales",
    timing: "売上確認時",
  },
  {
    title: "公開記事同期",
    description: "noteプロフィールの公開記事URLを既存Articleへ紐付けます。",
    href: "/imports/note-profile",
    timing: "記事追加後",
  },
];

export default function ImportsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div>
          <p className="text-sm font-medium text-zinc-500">Data Import</p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
            データ取込
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            OCR、販売履歴CSV、公開記事URL同期をここからまとめて実行します。
          </p>
        </div>

        <section className="grid gap-4 lg:grid-cols-3">
          {importRoutes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-zinc-950">
                  {route.title}
                </h2>
                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                  {route.timing}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {route.description}
              </p>
              <span className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white">
                開く
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
