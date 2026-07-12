"use client";

import { useActionState } from "react";
import type {
  NoteSalesImportPreview,
  NoteSalesImportResult,
} from "@/features/imports/note-sales/types";
import { numberFormatter, yenFormatter } from "../../articles/utils";
import {
  executeNoteSalesImportAction,
  type NoteSalesImportActionState,
} from "./actions";

type NoteSalesImportPreviewProps = {
  preview: NoteSalesImportPreview | undefined;
  result: NoteSalesImportResult | undefined;
};

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

const initialState: NoteSalesImportActionState = {};

export default function NoteSalesImportPreview({
  preview,
  result,
}: NoteSalesImportPreviewProps) {
  const [importState, importAction, isImportPending] = useActionState(
    executeNoteSalesImportAction,
    initialState,
  );
  const importResult = importState.result ?? result;

  if (importResult) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-emerald-950">
          インポート結果
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="新規記事作成数" value={`${importResult.createdArticles} 件`} />
          <SummaryCard label="既存記事更新数" value={`${importResult.updatedArticles} 件`} />
          <SummaryCard label="新規取引数" value={`${importResult.newTransactions} 件`} />
          <SummaryCard label="重複スキップ数" value={`${importResult.duplicateSkipped} 件`} />
          <SummaryCard label="エラー行数" value={`${importResult.errorRows} 件`} />
          <SummaryCard
            label="更新した日次実績数"
            value={`${importResult.updatedDailyMetrics} 件`}
          />
          <SummaryCard label="純購入数" value={`${importResult.netPurchases} 件`} />
          <SummaryCard label="純売上" value={yenFormatter.format(importResult.netRevenue)} />
        </div>
      </section>
    );
  }

  if (!preview) {
    return null;
  }

  const canImport = preview.summary.validRows > 0 && preview.summary.errorRows === 0;

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">
              インポートプレビュー
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              内容を確認してからインポートを実行してください。エラー行がある場合は保存できません。
            </p>
          </div>
          <form action={importAction} className="grid gap-3">
            <input type="hidden" name="payload" value={preview.payload} />
            <label className="flex gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <input
                type="checkbox"
                name="shouldUpdatePrices"
                defaultChecked
                className="mt-1 size-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900"
              />
              <span>最新販売額をArticle.priceへ反映する</span>
            </label>
            {importState.formError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {importState.formError}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={!canImport || isImportPending}
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isImportPending ? "インポート中" : "インポート実行"}
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="選択ファイル数" value={`${preview.summary.fileCount} 件`} />
          <SummaryCard label="総行数" value={`${preview.summary.totalRows} 行`} />
          <SummaryCard label="有効行数" value={`${preview.summary.validRows} 行`} />
          <SummaryCard label="エラー行数" value={`${preview.summary.errorRows} 行`} />
          <SummaryCard
            label="重複候補数"
            value={`${preview.summary.duplicateCandidates} 件`}
          />
          <SummaryCard label="新規記事数" value={`${preview.summary.newArticleCount} 件`} />
          <SummaryCard
            label="既存記事数"
            value={`${preview.summary.existingArticleCount} 件`}
          />
          <SummaryCard label="販売件数" value={`${preview.summary.salesCount} 件`} />
          <SummaryCard label="返金件数" value={`${preview.summary.refundCount} 件`} />
          <SummaryCard label="純売上" value={yenFormatter.format(preview.summary.netRevenue)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-950">記事別プレビュー</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="w-[24rem] px-5 py-3 text-left font-semibold text-zinc-700">
                  コンテンツ名
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  種別
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  新規/既存
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  販売
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  返金
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  純購入数
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  純売上
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  最新販売額
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  価格更新
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {preview.articles.length > 0 ? (
                preview.articles.map((article) => (
                  <tr key={article.title} className="hover:bg-zinc-50">
                    <td className="px-5 py-4 font-medium text-zinc-950">
                      {article.title}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                      {article.contentType}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                      {article.status === "new" ? "新規" : "既存"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {numberFormatter.format(article.salesCount)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {numberFormatter.format(article.refundCount)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {numberFormatter.format(article.netPurchases)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {yenFormatter.format(article.netRevenue)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {yenFormatter.format(article.latestSaleAmount)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                      {article.shouldUpdatePrice ? "更新候補" : "変更なし"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-zinc-500">
                    取り込み候補の記事はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-950">行エラー・スキップ</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  ファイル名
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  行番号
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  種別
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  理由
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {preview.issues.length > 0 ? (
                preview.issues.map((issue) => (
                  <tr
                    key={`${issue.fileName}-${issue.rowNumber}-${issue.reason}`}
                    className="hover:bg-zinc-50"
                  >
                    <td className="px-5 py-4 text-zinc-700">{issue.fileName}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {issue.rowNumber}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                      {issue.severity === "error"
                        ? "エラー"
                        : issue.severity === "skip"
                          ? "スキップ"
                          : "警告"}
                    </td>
                    <td className="px-5 py-4 text-zinc-700">{issue.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-zinc-500">
                    エラーやスキップはありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
