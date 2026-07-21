"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navigationGroups: NavGroup[] = [
  {
    title: "今日の運営",
    items: [{ label: "Today", href: "/today" }],
  },
  {
    title: "コンテンツ",
    items: [
      { label: "記事一覧", href: "/articles" },
      { label: "無料記事", href: "/free-articles" },
    ],
  },
  {
    title: "分析",
    items: [
      { label: "Revenue", href: "/revenue" },
      { label: "AI改善", href: "/ai-improvements" },
      { label: "Content Gap", href: "/content-gap" },
      { label: "Analytics", href: "/analytics" },
    ],
  },
  {
    title: "データ取込",
    items: [
      { label: "取込ホーム", href: "/imports" },
      { label: "noteアクセスOCR", href: "/imports/note-access" },
      { label: "販売履歴CSV", href: "/imports/note-sales" },
      { label: "公開記事同期", href: "/imports/note-profile" },
    ],
  },
  {
    title: "その他",
    items: [
      { label: "設定" },
      { label: "実運用移行", href: "/production-migration" },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white/95 text-zinc-950 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/today" className="w-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              note operations
            </p>
            <p className="mt-1 text-lg font-bold text-zinc-950">note運営OS</p>
          </Link>
          <Link
            href="/"
            className={`inline-flex h-9 w-fit items-center justify-center rounded-md px-3 text-sm font-semibold ring-1 transition ${
              isActivePath(pathname, "/")
                ? "bg-zinc-950 text-white ring-zinc-950"
                : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            Dashboard
          </Link>
        </div>

        <nav aria-label="Primary navigation" className="grid gap-3 lg:grid-cols-5">
          {navigationGroups.map((group) => (
            <div key={group.title} className="min-w-0">
              <p className="mb-2 text-xs font-semibold text-zinc-500">
                {group.title}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) =>
                  item.href ? (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold ring-1 transition ${
                        isActivePath(pathname, item.href)
                          ? "bg-zinc-950 text-white ring-zinc-950"
                          : "bg-zinc-50 text-zinc-700 ring-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      key={item.label}
                      className="inline-flex h-8 items-center rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-400 ring-1 ring-zinc-200"
                    >
                      {item.label}
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
