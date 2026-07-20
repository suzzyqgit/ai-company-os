"use client";

import { useState } from "react";
import Link from "next/link";
import {
  archiveFreeArticleAction,
  sendFreeArticleToImprovementAction,
  updateFreeArticleStatusAction,
} from "@/features/free-articles/actions";
import PublishCompletionRate from "@/components/free-articles/PublishCompletionRate";
import {
  freeArticleStatusLabels,
  getFreeArticleStatusClass,
  type FreeArticlePipelineStatus,
} from "@/features/free-articles/status";
import type { FreeArticlePipelineItem } from "@/features/free-articles/queries";

type FreeArticlePipelineCardsProps = {
  items: FreeArticlePipelineItem[];
};

function PipelineButton({
  children,
  variant = "default",
}: {
  children: string;
  variant?: "default" | "danger";
}) {
  const className =
    variant === "danger"
      ? "inline-flex h-9 items-center justify-center rounded-md bg-red-50 px-3 text-sm font-semibold text-red-700 ring-1 ring-red-200 transition hover:bg-red-100"
      : "inline-flex h-9 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50";

  return (
    <button type="submit" className={className}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: FreeArticlePipelineStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${getFreeArticleStatusClass(
        status,
      )}`}
    >
      {freeArticleStatusLabels[status]}
    </span>
  );
}

function getOperationState(item: FreeArticlePipelineItem) {
  if (item.status === "IMPROVING") {
    return {
      label: "改善中",
      className: "bg-violet-50 text-violet-700 ring-violet-200",
    };
  }

  if (item.status === "PUBLISHED" && item.improvementCount === 0) {
    return {
      label: "改善待ち",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
    };
  }

  if (item.status === "PUBLISHED") {
    return {
      label: "公開済み",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    };
  }

  return null;
}

function getLastImprovedLabel(item: FreeArticlePipelineItem) {
  if (item.improvementCount === 0) {
    return "未実施";
  }

  return item.updatedAt.toLocaleDateString("ja-JP");
}

function getEvaluationGradeClass(grade: string) {
  if (grade === "D" || grade === "C") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (grade === "B") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function getPriorityClass(priority: string) {
  if (priority === "高") {
    return "bg-red-100 text-red-700 ring-red-200";
  }

  if (priority === "中") {
    return "bg-amber-100 text-amber-700 ring-amber-200";
  }

  return "bg-emerald-100 text-emerald-700 ring-emerald-200";
}

function shouldShowEvaluationScore(item: FreeArticlePipelineItem) {
  return (
    item.evaluation?.phase === "reference" ||
    item.evaluation?.phase === "formal"
  );
}

export default function FreeArticlePipelineCards({
  items,
}: FreeArticlePipelineCardsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyDraft(item: FreeArticlePipelineItem) {
    await navigator.clipboard.writeText(item.fullDraft);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
        無料記事はまだありません。無料記事生成から最初の下書きを作成してください。
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      {items.map((item) => {
        const operationState = getOperationState(item);

        return (
        <article
          key={item.id}
          className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                {operationState ? (
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${operationState.className}`}
                  >
                    {operationState.label}
                  </span>
                ) : null}
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                  重複率 {item.duplicateScore}%
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-zinc-950">
                <Link
                  href={`/free-articles/${item.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
              </h2>
              <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-zinc-900">送客先Article:</span>{" "}
                  {item.destinationArticle?.title ?? "送客先未設定"}
                </p>
                <p>
                  <span className="font-semibold text-zinc-900">カテゴリ:</span>{" "}
                  {item.category}
                </p>
                <p>
                  <span className="font-semibold text-zinc-900">作成日:</span>{" "}
                  {item.createdAt.toLocaleDateString("ja-JP")}
                </p>
                <p>
                  <span className="font-semibold text-zinc-900">更新日:</span>{" "}
                  {item.updatedAt.toLocaleDateString("ja-JP")}
                </p>
              </div>
              {item.destinationNoteUrl ? (
                <a
                  href={item.destinationNoteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block break-all text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
                >
                  CTA先: {item.destinationNoteUrl}
                </a>
              ) : (
                <p className="mt-3 break-all text-sm font-medium text-zinc-500">
                  CTA先: 未設定
                </p>
              )}
              {item.status === "PUBLISHED" ? (
                <div className="mt-4 grid gap-2 rounded-md bg-emerald-50 p-3 text-sm text-zinc-700 ring-1 ring-emerald-200 sm:grid-cols-3">
                  <p className="font-semibold text-emerald-700">✅ 公開済み</p>
                  <p>
                    公開日:{" "}
                    {item.publishedAt
                      ? item.publishedAt.toLocaleDateString("ja-JP")
                      : "未設定"}
                  </p>
                  <p className="break-all sm:col-span-2">
                    note URL: {item.publishedUrl || "未設定"}
                  </p>
                  {item.publishedUrl ? (
                    <a
                      href={item.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-fit items-center justify-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      noteで開く
                    </a>
                  ) : null}
                  <p>PV: {item.publishedPv.toLocaleString("ja-JP")}</p>
                  <p>送客数: {item.referralCount.toLocaleString("ja-JP")}</p>
                  <p>購入数: {item.purchaseCount.toLocaleString("ja-JP")}</p>
                  <div className="sm:col-span-3">
                    <p className="font-semibold text-zinc-900">改善履歴</p>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      <p>
                        改善回数:{" "}
                        {item.improvementCount.toLocaleString("ja-JP")}
                      </p>
                      <p>最終改善日: {getLastImprovedLabel(item)}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-3">
                    <PublishCompletionRate
                      draftId={item.id}
                      isPublished={item.status === "PUBLISHED"}
                      hasPublishedUrl={Boolean(item.publishedUrl)}
                    />
                  </div>
                  {item.evaluation ? (
                    <div className="sm:col-span-3 rounded-md bg-white/75 p-3 ring-1 ring-emerald-200">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-zinc-900">AI評価カード</p>
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                          {item.evaluation.phaseLabel}
                        </span>
                        {shouldShowEvaluationScore(item) ? (
                          <>
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${getEvaluationGradeClass(
                                item.evaluation.grade,
                              )}`}
                            >
                              総合評価 {item.evaluation.grade}
                            </span>
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${getPriorityClass(
                                item.evaluation.priority,
                              )}`}
                            >
                              改善優先度 {item.evaluation.priority}
                            </span>
                          </>
                        ) : null}
                      </div>
                      {shouldShowEvaluationScore(item) ? (
                        <ul className="mt-3 grid gap-1 text-sm text-zinc-700">
                          {item.evaluation.reasons.length > 0 ? (
                            item.evaluation.reasons.map((reason) => (
                              <li key={reason}>・{reason}</li>
                            ))
                          ) : (
                            <li>・大きな改善リスクはありません</li>
                          )}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-zinc-600">
                          {item.evaluation.phaseLabel}のため、評価と改善提案はまだ表示しません。
                        </p>
                      )}
                      {item.improvementSuggestions.length > 0 ? (
                        <div className="mt-4 rounded-md bg-zinc-50 p-3 ring-1 ring-zinc-200">
                          <p className="text-sm font-semibold text-zinc-900">
                            改善提案
                          </p>
                          <ul className="mt-2 grid gap-1 text-sm text-zinc-700">
                            {item.improvementSuggestions
                              .slice(0, 3)
                              .map((suggestion) => (
                                <li key={suggestion.category}>
                                  ・{suggestion.category}
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                      <Link
                        href={`/free-articles/${item.id}`}
                        className="mt-3 inline-flex h-8 w-fit items-center justify-center rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800"
                      >
                        改善画面へ
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {item.status === "IMPROVING" ? (
                <div className="mt-4 grid gap-2 rounded-md bg-violet-50 p-3 text-sm text-violet-800 ring-1 ring-violet-200">
                  <p className="font-semibold">改善中</p>
                  <p>改善開始: {item.updatedAt.toLocaleDateString("ja-JP")}</p>
                  <p>
                    改善済みになったら編集画面で保存すると、公開済みに戻り改善回数が増えます。
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:w-80">
              <Link
                href={`/free-articles/${item.id}`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                編集
              </Link>
              <button
                type="button"
                onClick={() => void copyDraft(item)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
              >
                {copiedId === item.id ? "コピー済み" : "コピー"}
              </button>

              {item.status === "PUBLISHED" ? (
                <form action={sendFreeArticleToImprovementAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <PipelineButton>改善へ送る</PipelineButton>
                </form>
              ) : null}
              <form action={archiveFreeArticleAction}>
                <input type="hidden" name="id" value={item.id} />
                <PipelineButton variant="danger">Archive</PipelineButton>
              </form>
              {item.status !== "PUBLISHED" ? (
                <form action={updateFreeArticleStatusAction} className="sm:col-span-2">
                  <input type="hidden" name="id" value={item.id} />
                  <select
                    name="status"
                    defaultValue={item.status}
                    className="mb-2 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                  >
                    {Object.entries(freeArticleStatusLabels)
                      .filter(([status]) => status !== "PUBLISHED")
                      .map(([status, label]) => (
                        <option key={status} value={status}>
                          {label}
                        </option>
                      ))}
                  </select>
                  <PipelineButton>ステータス更新</PipelineButton>
                </form>
              ) : null}
            </div>
          </div>
        </article>
        );
      })}
    </section>
  );
}
