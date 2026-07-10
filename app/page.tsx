import Link from "next/link";

const menuItems = [
  { label: "記事一覧", href: "/articles" },
  { label: "売上管理", href: "#" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10">
        <nav aria-label="メインメニュー" className="w-full">
          <ul className="grid gap-4 sm:grid-cols-2">
            {menuItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex h-24 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg font-semibold shadow-sm transition hover:border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
