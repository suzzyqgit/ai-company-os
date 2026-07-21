import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getContentGapAnalysis } from "@/features/content-gap/queries";
import {
  formatTokyoDateInputValue,
  normalizeDateInputToTokyoDate,
} from "@/features/metrics/calculators";
import { getTodayData } from "@/features/today/queries";
import { getTodayTokyoDate, getWeekStartTokyoDate } from "@/features/today/calculators";
import { dateFormatter, numberFormatter, yenFormatter } from "../articles/utils";
import {
  createRevenueTaskAction,
  updateRevenueTaskStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

type KpiCard = {
  label: string;
  value: string;
  note: string;
};

type PriorityEvidence = {
  priorityScore: number;
  evidenceItems: string[];
};

type RevenueRecommendation = {
  key: string;
  title: string;
  targetTitle: string;
  articleId: string;
  href: string;
  priorityScore: number;
  reason: string;
  evidenceItems: string[];
};

type RevenueDashboardPageProps = {
  searchParams: Promise<{
    taskTitle?: string;
    taskPriority?: string;
    taskArticleId?: string;
  }>;
};

const revenueTaskStatusOrder = {
  TODO: 0,
  DOING: 1,
  DONE: 2,
} as const;

const revenueTaskStatusLabels = {
  TODO: "Todo",
  DOING: "Doing",
  DONE: "Done",
} as const;

const revenueTaskTypeLabels = {
  GENERAL: "General",
  CTA_IMPROVEMENT: "CTA改善",
} as const;

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatChangeRate(value: number | null) {
  if (value === null) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function formatCurrencyDelta(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${yenFormatter.format(value)}`;
}

function addDays(date: Date, days: number) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function getPurchaseRate(purchases: number, pv: number) {
  if (pv === 0) {
    return 0;
  }

  return (purchases / pv) * 100;
}

function getDaysSince(date: Date, now = new Date()) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / millisecondsPerDay));
}

function getPriorityTone(score: number) {
  if (score >= 75) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (score >= 50) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function buildArticlePriorityEvidence({
  pv,
  purchases,
  purchaseRate,
  price,
  updatedAt,
  missingCategoryCount,
  expectedImpact,
}: {
  pv: number;
  purchases: number;
  purchaseRate: number;
  price: number;
  updatedAt: Date;
  missingCategoryCount: number;
  expectedImpact: number;
}): PriorityEvidence {
  const evidenceItems: string[] = [];
  const staleDays = getDaysSince(updatedAt);
  let priorityScore = 0;

  if (pv >= 100 && purchaseRate < 5) {
    priorityScore += 35;
    evidenceItems.push(`PV${numberFormatter.format(pv)}で購入率${formatRate(purchaseRate)}`);
  } else if (pv >= 100 && purchaseRate < 10) {
    priorityScore += 25;
    evidenceItems.push(`PV${numberFormatter.format(pv)}で購入率10%未満`);
  } else if (pv >= 50 && purchaseRate < 10) {
    priorityScore += 15;
    evidenceItems.push(`PV${numberFormatter.format(pv)}で購入率改善余地あり`);
  }

  if (purchases > 0) {
    priorityScore += Math.min(20, purchases * 2);
    evidenceItems.push(`購入実績${numberFormatter.format(purchases)}件`);
  }

  if (missingCategoryCount >= 5) {
    priorityScore += 20;
    evidenceItems.push(`不足導線${numberFormatter.format(missingCategoryCount)}カテゴリ`);
  } else if (missingCategoryCount >= 3) {
    priorityScore += 14;
    evidenceItems.push(`不足導線${numberFormatter.format(missingCategoryCount)}カテゴリ`);
  } else if (missingCategoryCount > 0) {
    priorityScore += 8;
    evidenceItems.push(`不足導線あり`);
  }

  if (expectedImpact >= price * 2) {
    priorityScore += 15;
    evidenceItems.push(`Content Gap期待影響 ${yenFormatter.format(expectedImpact)}`);
  } else if (expectedImpact > 0) {
    priorityScore += 8;
    evidenceItems.push(`Content Gap期待影響あり`);
  }

  if (staleDays >= 90) {
    priorityScore += 10;
    evidenceItems.push(`最終更新から${numberFormatter.format(staleDays)}日`);
  } else if (staleDays >= 30) {
    priorityScore += 6;
    evidenceItems.push(`最終更新から30日以上`);
  }

  return {
    priorityScore: Math.min(100, priorityScore),
    evidenceItems:
      evidenceItems.length > 0 ? evidenceItems.slice(0, 3) : ["既存データ上は大きな懸念なし"],
  };
}

function PriorityBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold ring-1 ${getPriorityTone(score)}`}
    >
      {score}
    </span>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: RevenueRecommendation;
}) {
  const taskParams = new URLSearchParams({
    taskTitle: `${recommendation.title}: ${recommendation.targetTitle}`,
    taskPriority: String(recommendation.priorityScore),
    taskArticleId: recommendation.articleId,
  });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Recommendation
          </p>
          <h2 className="mt-2 text-base font-semibold text-zinc-950">
            {recommendation.title}
          </h2>
          <p className="mt-1 text-sm font-medium text-zinc-700">
            {recommendation.targetTitle}
          </p>
        </div>
        <PriorityBadge score={recommendation.priorityScore} />
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-600">
        {recommendation.reason}
      </p>
      <ul className="mt-3 grid gap-1 text-xs leading-5 text-zinc-500">
        {recommendation.evidenceItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={recommendation.href}
          className="inline-flex h-9 items-center justify-center rounded-md bg-white px-3 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
        >
          対象を見る
        </Link>
        <Link
          href={`/revenue?${taskParams.toString()}#revenue-task-form`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
        >
          Taskにする
        </Link>
      </div>
    </div>
  );
}

function KpiCardView({ card }: { card: KpiCard }) {
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

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-zinc-200 px-5 py-4">
      <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
      ) : null}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-5 py-8 text-sm text-zinc-500">{message}</p>;
}

function parseInitialTaskPriority(value: string | undefined) {
  const priority = Number(value);

  if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
    return 50;
  }

  return priority;
}

export default async function RevenueDashboardPage({
  searchParams,
}: RevenueDashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const today = getTodayTokyoDate();
  const weekStart = getWeekStartTokyoDate(today);
  const weekExclusiveTo = addDays(today, 1);
  const [todayData, contentGapAnalysis, revenueMetrics, paidArticles, revenueTasks] =
    await Promise.all([
      getTodayData(),
      getContentGapAnalysis(),
      prisma.articleDailyMetric.findMany({
        select: {
          articleId: true,
          pv: true,
          purchases: true,
          revenue: true,
          date: true,
        },
        orderBy: {
          date: "desc",
        },
      }),
      prisma.article.findMany({
        where: {
          status: "active",
          price: {
            gt: 0,
          },
        },
        select: {
          id: true,
          title: true,
          price: true,
          pv: true,
          purchases: true,
          updatedAt: true,
          noteUrl: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
      prisma.revenueTask.findMany({
        include: {
          article: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

  const totalRevenue = revenueMetrics.reduce(
    (total, metric) => total + metric.revenue,
    0,
  );
  const totalPv = revenueMetrics.reduce((total, metric) => total + metric.pv, 0);
  const totalPurchases = revenueMetrics.reduce(
    (total, metric) => total + metric.purchases,
    0,
  );
  const averagePurchaseRate = getPurchaseRate(totalPurchases, totalPv);
  const contentGapByArticleId = new Map(
    contentGapAnalysis.gaps.map((gap) => [gap.articleId, gap]),
  );
  const paidArticleEvidence = paidArticles.map((article) => {
    const purchaseRate = getPurchaseRate(article.purchases, article.pv);
    const gap = contentGapByArticleId.get(article.id);
    const evidence = buildArticlePriorityEvidence({
      pv: article.pv,
      purchases: article.purchases,
      purchaseRate,
      price: article.price,
      updatedAt: article.updatedAt,
      missingCategoryCount: gap?.missingCategories.length ?? 0,
      expectedImpact: gap?.expectedImpact ?? 0,
    });

    return {
      ...article,
      purchaseRate,
      missingCategoryCount: gap?.missingCategories.length ?? 0,
      expectedImpact: gap?.expectedImpact ?? 0,
      missingCategories: gap?.missingCategories ?? [],
      ...evidence,
    };
  });

  const articlesRequiringImprovement = paidArticleEvidence
    .filter((article) => article.pv >= 100 && article.purchaseRate < 10)
    .sort((left, right) => {
      const priorityDiff = right.priorityScore - left.priorityScore;

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.purchaseRate - right.purchaseRate;
    })
    .slice(0, 5);

  const resaleCandidates = paidArticleEvidence
    .filter((article) => article.purchases > 0)
    .map((article) => ({
      ...article,
      estimatedRevenue: article.price * article.purchases,
      purchaseRate: getPurchaseRate(article.purchases, article.pv),
    }))
    .sort((left, right) => {
      const priorityDiff = right.priorityScore - left.priorityScore;

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return right.estimatedRevenue - left.estimatedRevenue;
    })
    .slice(0, 5);

  const freeArticleCandidates = contentGapAnalysis.summary.freeArticleShortageRanking
    .filter((gap) => gap.missingCategories.length > 0)
    .map((gap) => ({
      ...gap,
      priorityScore: Math.min(
        100,
        gap.missingCategories.length * 12 + Math.min(40, Math.floor(gap.expectedImpact / 500)),
      ),
      evidenceItems: [
        `不足カテゴリ${numberFormatter.format(gap.missingCategories.length)}件`,
        `無料記事数${numberFormatter.format(gap.freeArticleCount)}件`,
        gap.expectedImpact > 0
          ? `期待影響 ${yenFormatter.format(gap.expectedImpact)}`
          : "期待影響は未算出",
      ],
    }))
    .sort((left, right) => {
      const priorityDiff = right.priorityScore - left.priorityScore;

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return right.missingCategories.length - left.missingCategories.length;
    })
    .slice(0, 5);
  const openChecklistItems = todayData.checklistItems
    .filter((item) => !item.completed)
    .slice(0, 5);
  const sortedRevenueTasks = [...revenueTasks].sort((left, right) => {
    const statusDiff =
      revenueTaskStatusOrder[left.status] - revenueTaskStatusOrder[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const priorityDiff = right.priority - left.priority;

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();

    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return left.id.localeCompare(right.id);
  });
  const completedTaskCount = revenueTasks.filter(
    (task) => task.status === "DONE",
  ).length;
  const completedThisWeekCount = revenueTasks.filter(
    (task) =>
      task.status === "DONE" &&
      task.completedAt !== null &&
      task.completedAt >= weekStart &&
      task.completedAt < weekExclusiveTo,
  ).length;
  const taskCompletionRate =
    revenueTasks.length === 0 ? 0 : (completedTaskCount / revenueTasks.length) * 100;
  const ctaImprovementTaskCount = revenueTasks.filter(
    (task) => task.type === "CTA_IMPROVEMENT" && task.status === "DONE",
  ).length;
  const publishedFreeArticleCount = await prisma.freeArticleDraft.count({
    where: {
      status: "PUBLISHED",
    },
  });
  const sevenDayRevenueRows = revenueTasks
    .filter(
      (task) =>
        task.status === "DONE" && task.completedAt !== null && task.articleId !== null,
    )
    .map((task) => {
      const completedDate = normalizeDateInputToTokyoDate(
        formatTokyoDateInputValue(task.completedAt ?? new Date(0)),
      );

      if (completedDate === null || task.completedAt === null || task.articleId === null) {
        return null;
      }

      const beforeFrom = addDays(completedDate, -7);
      const beforeExclusiveTo = completedDate;
      const afterFrom = completedDate;
      const afterExclusiveTo = addDays(completedDate, 7);
      const beforeRevenue = revenueMetrics
        .filter(
          (metric) =>
            metric.articleId === task.articleId &&
            metric.date >= beforeFrom &&
            metric.date < beforeExclusiveTo,
        )
        .reduce((total, metric) => total + metric.revenue, 0);
      const afterRevenue = revenueMetrics
        .filter(
          (metric) =>
            metric.articleId === task.articleId &&
            metric.date >= afterFrom &&
            metric.date < afterExclusiveTo,
        )
        .reduce((total, metric) => total + metric.revenue, 0);
      const delta = afterRevenue - beforeRevenue;
      const changeRate =
        beforeRevenue === 0 ? null : (delta / beforeRevenue) * 100;
      const isFinalized = today >= afterExclusiveTo;

      return {
        taskId: task.id,
        title: task.title,
        article: task.article,
        completedAt: task.completedAt,
        beforePeriod: `${formatTokyoDateInputValue(beforeFrom)}〜${formatTokyoDateInputValue(addDays(beforeExclusiveTo, -1))}`,
        afterPeriod: `${formatTokyoDateInputValue(afterFrom)}〜${formatTokyoDateInputValue(addDays(afterExclusiveTo, -1))}`,
        beforeRevenue,
        afterRevenue,
        delta,
        changeRate,
        isFinalized,
        elapsedDays: Math.max(
          0,
          Math.min(7, Math.floor((today.getTime() - afterFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1),
        ),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => {
      const completedAtDiff = right.completedAt.getTime() - left.completedAt.getTime();

      if (completedAtDiff !== 0) {
        return completedAtDiff;
      }

      return left.taskId.localeCompare(right.taskId);
    });
  const finalizedSevenDayRows = sevenDayRevenueRows.filter((row) => row.isFinalized);
  const sevenDayRevenueDelta = finalizedSevenDayRows.reduce(
    (total, row) => total + row.delta,
    0,
  );
  const revenueRecommendations: RevenueRecommendation[] = [
    ...articlesRequiringImprovement.map((article) => ({
      key: `improvement-${article.id}`,
      title: "購入率改善を確認",
      targetTitle: article.title,
      articleId: article.id,
      href: `/articles/${article.id}`,
      priorityScore: article.priorityScore,
      reason:
        article.purchaseRate < 5
          ? "PVがある一方で購入率が5%未満のため、本文・CTA・価格訴求の確認余地があります。"
          : "PV100以上かつ購入率10%未満のため、売上への影響を確認しやすい改善対象です。",
      evidenceItems: article.evidenceItems,
    })),
    ...resaleCandidates.map((article) => ({
      key: `resale-${article.id}`,
      title: "再販売導線を確認",
      targetTitle: article.title,
      articleId: article.id,
      href: `/articles/${article.id}`,
      priorityScore: article.priorityScore,
      reason:
        "購入実績がある有料記事のため、既存の勝ち筋を無料記事や導線から再利用できる可能性があります。",
      evidenceItems: [
        `売上目安 ${yenFormatter.format(article.estimatedRevenue)}`,
        ...article.evidenceItems.slice(0, 2),
      ],
    })),
    ...freeArticleCandidates.map((gap) => ({
      key: `free-article-${gap.articleId}`,
      title: "無料記事導線を補強",
      targetTitle: gap.title,
      articleId: gap.articleId,
      href: `/free-article-generator?destinationArticleId=${gap.articleId}`,
      priorityScore: gap.priorityScore,
      reason:
        "Content Gap上の不足カテゴリが残っているため、無料記事から有料記事への入口を増やす余地があります。",
      evidenceItems: gap.evidenceItems,
    })),
  ]
    .sort((left, right) => {
      const priorityDiff = right.priorityScore - left.priorityScore;

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.key.localeCompare(right.key);
    })
    .slice(0, 3);

  const kpiCards: KpiCard[] = [
    {
      label: "累計売上",
      value: yenFormatter.format(totalRevenue),
      note: "全期間のArticleDailyMetric売上合計",
    },
    {
      label: "購入件数",
      value: `${numberFormatter.format(totalPurchases)} 件`,
      note: "全期間のArticleDailyMetric購入数合計",
    },
    {
      label: "PV",
      value: numberFormatter.format(totalPv),
      note: "全期間のArticleDailyMetric PV合計",
    },
    {
      label: "CVR",
      value: formatRate(averagePurchaseRate),
      note: "購入件数 ÷ PV",
    },
    {
      label: "CTA改善数",
      value: `${numberFormatter.format(ctaImprovementTaskCount)} 件`,
      note: "CTA_IMPROVEMENTかつDONEのRevenue Task数",
    },
    {
      label: "無料記事公開数",
      value: `${numberFormatter.format(publishedFreeArticleCount)} 件`,
      note: "FreeArticleDraft.status = PUBLISHED",
    },
    {
      label: "今週実施した改善数",
      value: `${numberFormatter.format(completedThisWeekCount)} 件`,
      note: "今週DONEになったRevenue Task数",
    },
    {
      label: "改善実施率",
      value: formatRate(taskCompletionRate),
      note: "DONE件数 ÷ 全Revenue Task件数",
    },
    {
      label: "改善後7日売上変化",
      value: formatCurrencyDelta(sevenDayRevenueDelta),
      note: `7日経過済みTask ${numberFormatter.format(finalizedSevenDayRows.length)}件の差額合計`,
    },
  ];
  const initialTaskTitle = resolvedSearchParams.taskTitle?.trim() ?? "";
  const initialTaskPriority = parseInitialTaskPriority(
    resolvedSearchParams.taskPriority,
  );
  const initialTaskArticleId =
    paidArticles.some((article) => article.id === resolvedSearchParams.taskArticleId)
      ? resolvedSearchParams.taskArticleId
      : "";

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Revenue Operations
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
              Revenue Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              既存の売上・記事・Today・Content Gapデータを集約して、売上運営の現状だけを確認します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/analytics"
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              Analytics
            </Link>
            <Link
              href="/today"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              Today
            </Link>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kpiCards.map((card) => (
            <KpiCardView key={card.label} card={card} />
          ))}
        </section>

        <section className="grid gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <SectionHeader
              title="Revenue Recommendations"
              description="Priority Score上位候補から、既存データの根拠だけで決定論的に表示します。"
            />
            {revenueRecommendations.length > 0 ? (
              <div className="grid gap-4 p-5 lg:grid-cols-3">
                {revenueRecommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.key}
                    recommendation={recommendation}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="表示できるRevenue Recommendationはまだありません。" />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <SectionHeader
            title="Revenue Tasks"
            description="利益改善タスクをTodo / Doing / Doneで管理します。"
          />
          <form
            id="revenue-task-form"
            action={createRevenueTaskAction}
            className="grid gap-4 border-b border-zinc-200 p-5 lg:grid-cols-[1fr_140px_260px_auto]"
          >
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              タスク名
              <input
                name="title"
                required
                defaultValue={initialTaskTitle}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500"
                placeholder="例: CTAを見直す"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Priority
              <input
                name="priority"
                required
                type="number"
                min="0"
                max="100"
                defaultValue={initialTaskPriority}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Type
              <select
                name="type"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500"
                defaultValue="GENERAL"
              >
                {Object.entries(revenueTaskTypeLabels).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              関連記事
              <select
                name="articleId"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500"
                defaultValue={initialTaskArticleId}
              >
                <option value="">未設定</option>
                {paidArticles.map((article) => (
                  <option key={article.id} value={article.id}>
                    {article.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                Task作成
              </button>
            </div>
          </form>
          {sortedRevenueTasks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      Task
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      Type
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      Priority
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      関連記事
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      作成日
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      完了日
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      変更
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {sortedRevenueTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-zinc-50">
                      <td className="min-w-72 px-5 py-4 font-medium text-zinc-950">
                        {task.title}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex h-7 items-center rounded-md bg-zinc-100 px-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                          {revenueTaskStatusLabels[task.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex h-7 items-center rounded-md bg-zinc-100 px-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                          {revenueTaskTypeLabels[task.type]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(task.priority)}
                      </td>
                      <td className="min-w-64 px-5 py-4 text-zinc-700">
                        {task.article ? (
                          <Link
                            href={`/articles/${task.article.id}`}
                            className="font-medium text-zinc-950 underline-offset-4 hover:underline"
                          >
                            {task.article.title}
                          </Link>
                        ) : (
                          <span className="text-zinc-500">未設定</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                        {dateFormatter.format(task.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                        {task.completedAt
                          ? dateFormatter.format(task.completedAt)
                          : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(revenueTaskStatusLabels).map(
                            ([status, label]) => (
                              <form
                                key={status}
                                action={updateRevenueTaskStatusAction}
                              >
                                <input type="hidden" name="taskId" value={task.id} />
                                <input type="hidden" name="status" value={status} />
                                <button
                                  type="submit"
                                  disabled={task.status === status}
                                  className="inline-flex h-8 items-center rounded-md bg-white px-3 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                                >
                                  {label}
                                </button>
                              </form>
                            ),
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="Revenue Taskはまだありません。" />
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <SectionHeader
            title="改善後7日間の売上変化"
            description="Revenue Taskに紐づく記事の関連売上を、改善前後7日で機械的に比較します。厳密な因果証明ではありません。"
          />
          {sevenDayRevenueRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      Task
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      関連記事
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      完了日
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      改善前期間
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      改善後期間
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      改善前売上
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      改善後売上
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      差額
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                      増減率
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                      状態
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {sevenDayRevenueRows.map((row) => (
                    <tr key={row.taskId} className="hover:bg-zinc-50">
                      <td className="min-w-64 px-5 py-4 font-medium text-zinc-950">
                        {row.title}
                      </td>
                      <td className="min-w-64 px-5 py-4">
                        {row.article ? (
                          <Link
                            href={`/articles/${row.article.id}`}
                            className="font-medium text-zinc-950 underline-offset-4 hover:underline"
                          >
                            {row.article.title}
                          </Link>
                        ) : (
                          <span className="text-zinc-500">未設定</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                        {dateFormatter.format(row.completedAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                        {row.beforePeriod}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                        {row.afterPeriod}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-zinc-700">
                        {yenFormatter.format(row.beforeRevenue)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-zinc-700">
                        {yenFormatter.format(row.afterRevenue)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-semibold text-zinc-950">
                        {formatCurrencyDelta(row.delta)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-zinc-700">
                        {formatChangeRate(row.changeRate)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                        {row.isFinalized
                          ? "確定"
                          : `計測中 ${numberFormatter.format(row.elapsedDays)}日経過`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="完了済みかつ関連記事ありのRevenue Taskはまだありません。" />
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <SectionHeader
              title="Today's priority items"
              description="Todayの既存タスクから未完了項目を表示します。"
            />
            <div className="divide-y divide-zinc-100">
              <div className="px-5 py-4">
                <p className="text-sm font-semibold text-zinc-950">
                  {todayData.advisorRecommendation.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {todayData.advisorRecommendation.reason}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  期待効果: {todayData.advisorRecommendation.expectedEffect} /
                  所要時間: {todayData.advisorRecommendation.estimatedMinutes}分
                </p>
              </div>
              {openChecklistItems.length > 0 ? (
                openChecklistItems.map((item) => (
                  <div key={item.key} className="px-5 py-4">
                    <p className="text-sm font-medium text-zinc-950">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Todayチェックリスト未完了
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState message="Todayチェックリストは完了しています。" />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <SectionHeader
              title="Free article candidates"
              description="Content Gapの既存不足カテゴリから、優先度スコア順に表示します。"
            />
            {freeArticleCandidates.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {freeArticleCandidates.map((gap) => (
                  <div key={gap.articleId} className="px-5 py-4">
                    <Link
                      href={`/free-article-generator?destinationArticleId=${gap.articleId}`}
                      className="text-sm font-semibold text-zinc-950 underline-offset-4 hover:underline"
                    >
                      {gap.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityBadge score={gap.priorityScore} />
                      <span className="text-xs font-medium text-zinc-500">
                        Priority Score
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      不足カテゴリ: {gap.missingCategories.slice(0, 3).join(" / ")}
                    </p>
                    <ul className="mt-2 grid gap-1 text-xs text-zinc-500">
                      {gap.evidenceItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="無料記事候補として表示する不足カテゴリはありません。" />
            )}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <SectionHeader
              title="Articles requiring improvement"
              description="PV100以上かつ購入率10%未満の記事を、優先度スコア順に表示します。"
            />
            {articlesRequiringImprovement.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                        記事
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        Score
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        PV
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        購入数
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        購入率
                      </th>
                      <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                        根拠
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {articlesRequiringImprovement.map((article) => (
                      <tr key={article.id} className="hover:bg-zinc-50">
                        <td className="min-w-72 px-5 py-4">
                          <Link
                            href={`/articles/${article.id}`}
                            className="font-medium text-zinc-950 underline-offset-4 hover:underline"
                          >
                            {article.title}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <PriorityBadge score={article.priorityScore} />
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-zinc-700">
                          {numberFormatter.format(article.pv)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-zinc-700">
                          {numberFormatter.format(article.purchases)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums font-semibold text-zinc-950">
                          {formatRate(article.purchaseRate)}
                        </td>
                        <td className="min-w-56 px-5 py-4 text-xs leading-5 text-zinc-500">
                          {article.evidenceItems.join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="条件に該当する改善対象記事はありません。" />
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <SectionHeader
              title="Resale candidates"
              description="購入実績がある有料記事を、既存データ由来の優先度スコア順に表示します。"
            />
            {resaleCandidates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                        記事
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        Score
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        売上目安
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        購入数
                      </th>
                      <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                        購入率
                      </th>
                      <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                        根拠
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {resaleCandidates.map((article) => (
                      <tr key={article.id} className="hover:bg-zinc-50">
                        <td className="min-w-72 px-5 py-4">
                          <Link
                            href={`/articles/${article.id}`}
                            className="font-medium text-zinc-950 underline-offset-4 hover:underline"
                          >
                            {article.title}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <PriorityBadge score={article.priorityScore} />
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-zinc-700">
                          {yenFormatter.format(article.estimatedRevenue)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-zinc-700">
                          {numberFormatter.format(article.purchases)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums font-semibold text-zinc-950">
                          {formatRate(article.purchaseRate)}
                        </td>
                        <td className="min-w-56 px-5 py-4 text-xs leading-5 text-zinc-500">
                          {article.evidenceItems.join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="購入実績がある有料記事はまだありません。" />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
