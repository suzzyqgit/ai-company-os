import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { numberFormatter, yenFormatter } from "./articles/utils";
import { getTodayData } from "@/features/today/queries";
import { getTodayTokyoDate } from "@/features/today/calculators";

export const dynamic = "force-dynamic";

type DashboardCard = {
  label: string;
  value: string;
  note: string;
};

type RouteCard = {
  title: string;
  description: string;
  href: string;
  label: string;
};

const routeCards: RouteCard[] = [
  {
    title: "今日の運営",
    description: "今日やること、改善記事、無料記事、取込状況を確認します。",
    href: "/today",
    label: "Todayを開く",
  },
  {
    title: "データ取込",
    description: "OCR、販売履歴CSV、公開記事URL同期をまとめて扱います。",
    href: "/imports",
    label: "取込を開く",
  },
  {
    title: "分析・改善",
    description: "売上分析、AI改善、Content Gapから改善優先度を見ます。",
    href: "/analytics",
    label: "分析を開く",
  },
  {
    title: "コンテンツ",
    description: "有料記事と無料記事パイプラインを管理します。",
    href: "/free-articles",
    label: "無料記事を見る",
  },
];

function KpiCard({ card }: { card: DashboardCard }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{card.label}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-950">
        {card.value}
      </p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{card.note}</p>
    </div>
  );
}

export default async function Home() {
  const today = getTodayTokyoDate();
  const monthStart = new Date(today);
  monthStart.setUTCDate(1);

  const [todayData, monthMetrics] = await Promise.all([
    getTodayData(),
    prisma.articleDailyMetric.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: today,
        },
      },
      select: {
        purchases: true,
        revenue: true,
      },
    }),
  ]);

  const monthRevenue = monthMetrics.reduce(
    (total, metric) => total + metric.revenue,
    0,
  );
  const monthPurchases = monthMetrics.reduce(
    (total, metric) => total + metric.purchases,
    0,
  );
  const remainingTasks = todayData.checklistItems.filter(
    (item) => !item.completed,
  ).length;

  const kpiCards: DashboardCard[] = [
    {
      label: "今月売上",
      value: yenFormatter.format(monthRevenue),
      note: "日次実績に登録された今月の売上",
    },
    {
      label: "今日PV",
      value: numberFormatter.format(todayData.todayKpis.todayPv),
      note: "今日の日次実績に登録されたPV",
    },
    {
      label: "今月購入数",
      value: `${numberFormatter.format(monthPurchases)} 件`,
      note: "販売履歴CSV・日次実績から集計",
    },
    {
      label: "今日やること",
      value: `${numberFormatter.format(remainingTasks)} 件`,
      note: "Todayチェックリストの未完了数",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Dashboard</p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
              全体確認
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              細かい作業はTodayへ、分析はAnalyticsやContent Gapへ分けて確認します。
            </p>
          </div>
          <Link
            href="/today"
            className="inline-flex h-11 w-fit items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
          >
            Todayを開く
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => (
            <KpiCard key={card.label} card={card} />
          ))}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-500">今日の入口</p>
              <h2 className="mt-2 text-xl font-bold text-zinc-950">
                {todayData.primaryTask.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                {todayData.primaryTask.reason} 期待効果:{" "}
                {todayData.primaryTask.expectedEffect}
              </p>
            </div>
            <Link
              href={todayData.primaryTask.href}
              className="inline-flex h-10 w-fit shrink-0 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              {todayData.primaryTask.buttonLabel}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {routeCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <h2 className="text-base font-semibold text-zinc-950">
                {card.title}
              </h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-600">
                {card.description}
              </p>
              <span className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-zinc-100 px-3 text-sm font-semibold text-zinc-800">
                {card.label}
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
