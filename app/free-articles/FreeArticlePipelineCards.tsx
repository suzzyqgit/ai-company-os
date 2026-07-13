"use client";

import { useState } from "react";
import Link from "next/link";
import {
  archiveFreeArticleAction,
  markFreeArticlePublishedAction,
  sendFreeArticleToImprovementAction,
  updateFreeArticleStatusAction,
} from "@/features/free-articles/actions";
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
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                  重複率 {item.duplicateScore}%
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-zinc-950">{item.title}</h2>
              <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-zinc-900">送客先Article:</span>{" "}
                  {item.destinationArticle.title}
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
              <a
                href={item.destinationNoteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block break-all text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
              >
                CTA先: {item.destinationNoteUrl || "未設定"}
              </a>
              {item.status === "PUBLISHED" ? (
                <div className="mt-4 grid gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 sm:grid-cols-3">
                  <p>
                    公開日:{" "}
                    {item.publishedAt
                      ? item.publishedAt.toLocaleDateString("ja-JP")
                      : "未設定"}
                  </p>
                  <p className="break-all sm:col-span-2">
                    note URL: {item.publishedUrl || "未設定"}
                  </p>
                  <p>PV: {item.publishedPv.toLocaleString("ja-JP")}</p>
                  <p>送客数: {item.referralCount.toLocaleString("ja-JP")}</p>
                  <p>購入数: {item.purchaseCount.toLocaleString("ja-JP")}</p>
                  <p>改善回数: {item.improvementCount.toLocaleString("ja-JP")}</p>
                </div>
              ) : null}
            </div>

            <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:w-80">
              <Link
                href={`/free-article-generator?articleId=${item.destinationArticle.id}`}
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

              <form action={markFreeArticlePublishedAction} className="sm:col-span-2">
                <input type="hidden" name="id" value={item.id} />
                <input
                  type="url"
                  name="publishedUrl"
                  placeholder="公開後のnote URL"
                  defaultValue={item.publishedUrl}
                  className="mb-2 h-9 w-full rounded-md border border-zinc-300 px-3 text-sm shadow-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 w-full items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  公開済みにする
                </button>
              </form>

              <form action={sendFreeArticleToImprovementAction}>
                <input type="hidden" name="id" value={item.id} />
                <PipelineButton>改善へ送る</PipelineButton>
              </form>
              <form action={archiveFreeArticleAction}>
                <input type="hidden" name="id" value={item.id} />
                <PipelineButton variant="danger">Archive</PipelineButton>
              </form>
              <form action={updateFreeArticleStatusAction} className="sm:col-span-2">
                <input type="hidden" name="id" value={item.id} />
                <select
                  name="status"
                  defaultValue={item.status}
                  className="mb-2 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
                >
                  {Object.entries(freeArticleStatusLabels).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
                <PipelineButton>ステータス更新</PipelineButton>
              </form>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
