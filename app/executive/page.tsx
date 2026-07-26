import Link from "next/link";
import type { ReactNode } from "react";
import { getExecutiveWorkflowData } from "@/features/executive/queries";
import type { ReadinessStatus } from "@/features/executive/calculators";

export const dynamic = "force-dynamic";

const statusLabels = {
  READY: "READY",
  PARTIAL: "PARTIAL",
  BLOCKED: "BLOCKED",
  EMPTY: "EMPTY",
} satisfies Record<ReadinessStatus, string>;

const statusClasses = {
  READY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PARTIAL: "bg-amber-50 text-amber-700 ring-amber-200",
  BLOCKED: "bg-red-50 text-red-700 ring-red-200",
  EMPTY: "bg-zinc-100 text-zinc-600 ring-zinc-200",
} satisfies Record<ReadinessStatus, string>;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: ReadinessStatus }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold ring-1 ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-zinc-500">{children}</p>;
}

export default async function ExecutiveWorkflowPage() {
  const {
    input,
    ownerActionItems,
    currentCaseStatus,
    readinessItems,
    blockingIssues,
  } = await getExecutiveWorkflowData();

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Executive Workflow</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">
              Executive Workflow Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Case No.002の事業状態、停止要因、次に誰へ何を指示すべきかを
              既存データだけで判定します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/today"
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50"
            >
              Today
            </Link>
            <Link
              href="/revenue"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              Revenue
            </Link>
          </div>
        </div>

        <Section
          title="Owner Action Center"
          description="優先順位順に、Ownerが次に誰へ何を指示すべきかを表示します。"
        >
          {ownerActionItems.length > 0 ? (
            <div className="grid gap-3">
              {ownerActionItems.map((item) => (
                <article
                  key={`${item.priority}-${item.assignee}-${item.action}`}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-7 items-center rounded-md bg-zinc-950 px-2 text-xs font-semibold text-white">
                          {item.priority}
                        </span>
                        <span className="inline-flex h-7 items-center rounded-md bg-white px-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                          {item.assignee}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-zinc-950">
                        {item.action}
                      </h3>
                    </div>
                    <p className="text-xs leading-5 text-zinc-500 md:max-w-xs">
                      Blocking Dependency: {item.blockingDependency}
                    </p>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700 md:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-zinc-950">Reason</dt>
                      <dd>{item.reason}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-zinc-950">
                        Expected Outcome
                      </dt>
                      <dd>{item.expectedOutcome}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState>現在、Ownerの即時判断が必要なActionはありません。</EmptyState>
          )}
        </Section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Section title="Current Case Status">
            <dl className="grid gap-4 text-sm leading-6">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-zinc-950">Case ID</dt>
                <dd className="text-right text-zinc-700">
                  {currentCaseStatus.caseId}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-zinc-950">Current Phase</dt>
                <dd className="text-right text-zinc-700">
                  {currentCaseStatus.currentPhase}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-zinc-950">Status</dt>
                <dd>
                  <StatusBadge status={currentCaseStatus.status} />
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-950">Blocked By</dt>
                <dd className="mt-1 text-zinc-700">{currentCaseStatus.blockedBy}</dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-950">Next Gate</dt>
                <dd className="mt-1 text-zinc-700">{currentCaseStatus.nextGate}</dd>
              </div>
              <div>
                <dt className="font-semibold text-zinc-950">
                  Owner Decision Required
                </dt>
                <dd className="mt-1 text-zinc-700">
                  {currentCaseStatus.ownerDecisionRequired}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Current Data Snapshot">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["CanonicalSalesRecord", input.canonicalSalesRecordCount],
                ["Pending Sales Records", input.pendingCanonicalSalesRecordCount],
                ["Approved Sales Records", input.approvedCanonicalSalesRecordCount],
                ["Static Articles", input.staticArticleCount],
                ["App Articles", input.articleCount],
                ["Products", input.productCount],
                ["Sales", input.saleCount],
                ["Revenue Tasks", input.revenueTaskCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                >
                  <p className="text-xs font-medium text-zinc-500">{label}</p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-zinc-950">
                    {Number(value).toLocaleString("ja-JP")}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </section>

        <Section title="Data Readiness">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {readinessItems.map((item) => (
              <article
                key={item.area}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-950">
                    {item.area}
                  </h3>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-700">
                  {item.evidence}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {item.missingCondition}
                </p>
              </article>
            ))}
          </div>
        </Section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Section title="Product Layer Readiness">
            <p className="text-sm leading-6 text-zinc-700">
              Product Master: {input.productCount.toLocaleString("ja-JP")} records
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              Article table: {input.articleCount.toLocaleString("ja-JP")} records
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Productが0件の場合、CPOのProduct Master初期化がPromotionの前提です。
            </p>
          </Section>

          <Section title="Revenue Operation Status">
            <p className="text-sm leading-6 text-zinc-700">
              RevenueTask: {input.revenueTaskCount.toLocaleString("ja-JP")} records
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              Open Tasks: {input.openRevenueTaskCount.toLocaleString("ja-JP")} records
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              RevenueTaskが0件の場合、Revenue Operationは未稼働として扱います。
            </p>
          </Section>

          <Section title="Role Next Actions">
            <ul className="grid gap-2 text-sm leading-6 text-zinc-700">
              {ownerActionItems.slice(0, 4).map((item) => (
                <li key={`${item.assignee}-${item.action}`}>
                  <span className="font-semibold text-zinc-950">
                    {item.assignee}:
                  </span>{" "}
                  {item.action}
                </li>
              ))}
            </ul>
          </Section>
        </section>

        <Section
          title="Blocking Issues"
          description="原因、事業影響、解除方法、担当ロールを明示します。"
        >
          {blockingIssues.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-zinc-500">
                    <th className="px-3 py-2">Area</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Cause</th>
                    <th className="px-3 py-2">Impact</th>
                    <th className="px-3 py-2">Resolution</th>
                    <th className="px-3 py-2">Responsible Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {blockingIssues.map((issue) => (
                    <tr key={`${issue.area}-${issue.cause}`}>
                      <td className="px-3 py-3 font-medium text-zinc-950">
                        {issue.area}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={issue.status} />
                      </td>
                      <td className="px-3 py-3 text-zinc-700">{issue.cause}</td>
                      <td className="px-3 py-3 text-zinc-700">{issue.impact}</td>
                      <td className="px-3 py-3 text-zinc-700">
                        {issue.resolution}
                      </td>
                      <td className="px-3 py-3 text-zinc-700">
                        {issue.responsibleRole}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>現在のデータではBlocking Issueはありません。</EmptyState>
          )}
        </Section>
      </div>
    </main>
  );
}
