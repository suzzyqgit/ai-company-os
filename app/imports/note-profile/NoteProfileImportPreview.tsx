"use client";

import { useActionState } from "react";
import type {
  NoteProfileImportResult,
  NoteProfilePreview,
} from "@/features/imports/note-profile/types";
import { numberFormatter, yenFormatter } from "../../articles/utils";
import {
  executeNoteProfileImportAction,
  type NoteProfileImportActionState,
} from "./actions";

type NoteProfileImportPreviewProps = {
  preview: NoteProfilePreview | undefined;
  result: NoteProfileImportResult | undefined;
};

const initialState: NoteProfileImportActionState = {};

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

function matchMethodLabel(method: string) {
  const labels: Record<string, string> = {
    exact: "完全一致",
    normalized: "正規化一致",
    partial: "部分一致",
    similarity: "類似一致",
  };

  return labels[method] ?? method;
}

export default function NoteProfileImportPreview({
  preview,
  result,
}: NoteProfileImportPreviewProps) {
  const [importState, importAction, isImportPending] = useActionState(
    executeNoteProfileImportAction,
    initialState,
  );
  const importResult = importState.result ?? result;

  if (importResult) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-emerald-950">反映結果</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="noteUrl更新"
            value={`${importResult.updatedArticles} 件`}
          />
          <SummaryCard
            label="Article新規作成"
            value={`${importResult.createdArticles} 件`}
          />
          <SummaryCard
            label="スキップ"
            value={`${importResult.skippedArticles} 件`}
          />
        </div>
      </section>
    );
  }

  if (!preview) {
    return null;
  }

  const updateCandidates = preview.matchedArticles.filter(
    (article) => article.shouldUpdateNoteUrl,
  );

  return (
    <form action={importAction} className="grid gap-6">
      <input type="hidden" name="payload" value={preview.payload} />

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">
              公開記事取得プレビュー
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              既存ArticleへnoteUrlを登録し、Articleに存在しない無料記事も必要に応じて作成できます。
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

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="プロフィール" value={preview.urlname} />
          <SummaryCard
            label="公開記事数"
            value={`${numberFormatter.format(preview.totalPublicArticles)} 件`}
          />
          <SummaryCard
            label="既存Article照合"
            value={`${numberFormatter.format(preview.matchedArticles.length)} 件`}
          />
          <SummaryCard
            label="Article未登録"
            value={`${numberFormatter.format(preview.missingArticles.length)} 件`}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-950">
            既存ArticleへのnoteUrl登録
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  反映
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  公開記事タイトル
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  Articleタイトル
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  照合
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  note URL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {updateCandidates.length > 0 ? (
                updateCandidates.map((article) => (
                  <tr key={article.publicArticle.noteUrl} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-5 py-4">
                      <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          name="existingArticle"
                          value={`${article.articleId}\t${article.publicArticle.noteUrl}`}
                          defaultChecked
                          className="size-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900"
                        />
                        登録
                      </label>
                    </td>
                    <td className="min-w-80 px-5 py-4 font-medium text-zinc-950">
                      {article.publicArticle.title}
                    </td>
                    <td className="min-w-80 px-5 py-4 text-zinc-700">
                      {article.articleTitle}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                      {matchMethodLabel(article.matchMethod)} /{" "}
                      {Math.round(article.confidence * 100)}%
                    </td>
                    <td className="min-w-96 px-5 py-4 text-zinc-700">
                      {article.publicArticle.noteUrl}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-500">
                    更新が必要な既存Articleはありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-950">
            公開記事に存在するがArticleに存在しない記事
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            販売履歴CSVに存在しない無料記事も、チェックした行だけ管理対象にできます。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  作成
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  タイトル
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  価格
                </th>
                <th className="px-5 py-3 text-left font-semibold text-zinc-700">
                  note URL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {preview.missingArticles.length > 0 ? (
                preview.missingArticles.map((article) => (
                  <tr key={article.publicArticle.noteUrl} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-5 py-4">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
                        <input
                          type="checkbox"
                          name="createArticle"
                          value={article.publicArticle.noteUrl}
                          defaultChecked
                          className="size-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900"
                        />
                        Articleを新規作成する
                      </label>
                    </td>
                    <td className="min-w-96 px-5 py-4 font-medium text-zinc-950">
                      {article.publicArticle.title}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                      {yenFormatter.format(article.publicArticle.price)}
                    </td>
                    <td className="min-w-96 px-5 py-4 text-zinc-700">
                      {article.publicArticle.noteUrl}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-zinc-500">
                    公開記事はすべて既存Articleと照合できています。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  );
}
