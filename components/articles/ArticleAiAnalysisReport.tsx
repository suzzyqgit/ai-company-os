import type { ArticleAiAnalysisView } from "@/features/ai/queries";
import { dateFormatter } from "@/app/articles/utils";
import type { ReactNode } from "react";

type ArticleAiAnalysisReportProps = {
  analysis: ArticleAiAnalysisView | null;
};

const priorityLabels = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

const priorityClasses = {
  high: "bg-red-50 text-red-700 ring-red-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-zinc-100 text-zinc-700 ring-zinc-200",
} as const;

function PriorityBadge({ priority }: { priority: keyof typeof priorityLabels }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ring-1 ${priorityClasses[priority]}`}
    >
      {priorityLabels[priority]}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-zinc-950">{children}</h3>;
}

export default function ArticleAiAnalysisReport({
  analysis,
}: ArticleAiAnalysisReportProps) {
  if (!analysis) {
    return (
      <p className="px-5 py-8 text-sm text-zinc-500">
        AI改善レポートはまだありません。記事データと過去30日の実績をもとに生成できます。
      </p>
    );
  }

  const report = analysis.report;

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap gap-2 text-sm text-zinc-600">
        <span className="rounded-md bg-zinc-100 px-3 py-1">
          実行日: {dateFormatter.format(analysis.createdAt)}
        </span>
        <span className="rounded-md bg-zinc-100 px-3 py-1">
          モデル: {analysis.model}
        </span>
        <span className="rounded-md bg-zinc-100 px-3 py-1">
          キャッシュ: 同じ入力では既存結果を再利用
        </span>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <SectionTitle>全体評価</SectionTitle>
        <p className="mt-3 text-sm leading-6 text-zinc-700">{report.summary}</p>
      </section>

      <section>
        <SectionTitle>問題点</SectionTitle>
        <div className="mt-3 space-y-3">
          {report.issues.length > 0 ? (
            report.issues.map((issue) => (
              <div
                key={`${issue.priority}-${issue.title}`}
                className="rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-zinc-950">
                    {issue.title}
                  </p>
                  <PriorityBadge priority={issue.priority} />
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-700">
                  {issue.reason}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">問題点はありません。</p>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>優先改善アクション</SectionTitle>
        <div className="mt-3 space-y-3">
          {report.actions.map((action) => (
            <div
              key={`${action.priority}-${action.title}`}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-zinc-950">
                  {action.title}
                </p>
                <PriorityBadge priority={action.priority} />
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                {action.detail}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                期待効果: {action.expectedEffect}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>タイトル案</SectionTitle>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {report.titleSuggestions.map((title, index) => (
            <li
              key={`${title}-${index}`}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
            >
              {index + 1}. {title}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle>指標の解釈</SectionTitle>
        <dl className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm font-medium text-zinc-500">PV</dt>
            <dd className="text-sm leading-6 text-zinc-700">
              {report.metricsInterpretation.pv}
            </dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm font-medium text-zinc-500">購入率</dt>
            <dd className="text-sm leading-6 text-zinc-700">
              {report.metricsInterpretation.conversionRate}
            </dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm font-medium text-zinc-500">Master遷移率</dt>
            <dd className="text-sm leading-6 text-zinc-700">
              {report.metricsInterpretation.masterTransitionRate}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <SectionTitle>分析上の制約</SectionTitle>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600">
          {report.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
