"use client";

import { useActionState } from "react";
import type {
  NoteAccessImportResult,
  NoteAccessPreview,
} from "@/features/imports/note-access/types";
import { numberFormatter } from "../../articles/utils";
import {
  executeNoteAccessImportAction,
  type NoteAccessImportActionState,
} from "./actions";

type NoteAccessImportPreviewProps = {
  preview: NoteAccessPreview | undefined;
  result: NoteAccessImportResult | undefined;
};

const initialState: NoteAccessImportActionState = {};
const autoSelectThreshold = 0.8;

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-zinc-950">
        {value}
      </p>
    </div>
  );
}

function getRowStatus(item: NoteAccessPreview["items"][number]) {
  if (item.warning) {
    return {
      label: item.warning,
      className: "bg-amber-50 text-amber-700 ring-amber-200",
    };
  }

  if (!item.matchedArticleId || item.matchSimilarity < autoSelectThreshold) {
    return {
      label: "要確認",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
    };
  }

  return {
    label: "更新候補",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
}

export default function NoteAccessImportPreview({
  preview,
  result,
}: NoteAccessImportPreviewProps) {
  const [importState, importAction, isImportPending] = useActionState(
    executeNoteAccessImportAction,
    initialState,
  );
  const importResult = importState.result ?? result;

  if (importResult) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-emerald-950">反映結果</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="更新記事数" value={`${importResult.updatedArticles} 件`} />
          <SummaryCard label="警告" value={`${importResult.warningItems} 件`} />
          <SummaryCard label="スキップ" value={`${importResult.skippedItems} 件`} />
          <SummaryCard label="保存行数" value={`${importResult.savedItems} 件`} />
          <SummaryCard label="取込ID" value={importResult.runId} />
        </div>
      </section>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <form action={importAction} className="grid gap-6">
      <input type="hidden" name="payload" value={preview.payload} />

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">
              OCR抽出結果プレビュー
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Articleを選択してから反映してください。現在PVより小さい値は更新せず、警告として履歴に保存します。
            </p>
          </div>
          <button
            type="submit"
            disabled={isImportPending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isImportPending ? "反映中" : "選択内容を反映"}
          </button>
        </div>

        {importState.formError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {importState.formError}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="画像数" value={`${preview.fileCount} 件`} />
          <SummaryCard label="抽出行数" value={`${preview.items.length} 件`} />
          <SummaryCard
            label="Article候補"
            value={`${preview.articles.length} 件`}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-950">
            記事タイトルとPV
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  画像
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  OCR原文
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  OCRタイトル
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  正規化後
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  Article
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  照合
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  現在PV
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  反映PV
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  状態
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {preview.items.map((item, index) => {
                const status = getRowStatus(item);

                return (
                  <tr key={`${item.sourceFileName}-${index}`} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                      {item.sourceFileName}
                    </td>
                    <td className="min-w-80 px-5 py-4 text-xs leading-5 text-zinc-600">
                      {item.originalOcrLine}
                    </td>
                    <td className="min-w-96 px-5 py-4">
                      <input
                        name={`title-${index}`}
                        type="text"
                        defaultValue={item.extractedTitle}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-950 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                      />
                    </td>
                  <td className="min-w-96 px-5 py-4 text-zinc-700">
                    {item.normalizedTitle}
                  </td>
                  <td className="min-w-96 px-5 py-4">
                    <select
                      name={`articleId-${index}`}
                      defaultValue={item.matchedArticleId ?? ""}
                      className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    >
                      <option value="">選択しない</option>
                      {preview.articles.map((article) => (
                        <option key={article.id} value={article.id}>
                          {article.title}
                        </option>
                      ))}
                    </select>
                    {item.matchedArticleTitle ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        自動候補: {item.matchedArticleTitle}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                    {item.matchMethod ? (
                      <div className="grid gap-1">
                        <span className="font-medium text-zinc-950">
                          {item.matchMethod}
                        </span>
                        <span className="text-xs text-zinc-500">
                          類似度 {Math.round(item.matchSimilarity * 100)}% / 信頼度{" "}
                          {Math.round(item.matchConfidence * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-400">候補なし</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                    {item.currentPv === null
                      ? "-"
                      : numberFormatter.format(item.currentPv)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <input
                      name={`pv-${index}`}
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={item.extractedPv}
                      className="h-10 w-28 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm tabular-nums text-zinc-950 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    />
                  </td>
                  <td className="min-w-72 px-5 py-4 text-zinc-700">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  );
}
