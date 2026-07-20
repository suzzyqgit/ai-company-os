import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  archiveFreeArticleAction,
  markFreeArticlePublishedAction,
  sendFreeArticleToImprovementAction,
  updateFreeArticleDraftAction,
  updateFreeArticleStatusAction,
} from "@/features/free-articles/actions";
import PublishChecklist from "@/components/free-articles/PublishChecklist";
import { getFreeArticleEditorData } from "@/features/free-articles/queries";
import {
  freeArticleStatusLabels,
  getFreeArticleStatusClass,
  type FreeArticlePipelineStatus,
} from "@/features/free-articles/status";
import CopyFreeArticleButton from "./CopyFreeArticleButton";

type FreeArticleEditorPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

function Field({
  label,
  name,
  defaultValue,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-zinc-700">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
      />
    </div>
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

function StatusActionButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex h-9 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}

function getErrorMessage(error?: string) {
  if (error === "publishedUrlRequired") {
    return "公開URLを入力してください";
  }

  if (error === "invalidPublishedUrl") {
    return "https://note.com/ の公開URLを入力してください";
  }

  return "";
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

function shouldShowEvaluationScore(
  evaluation: NonNullable<
    Awaited<ReturnType<typeof getFreeArticleEditorData>>
  >["draft"]["evaluation"],
) {
  return evaluation?.phase === "reference" || evaluation?.phase === "formal";
}

export default async function FreeArticleEditorPage({
  params,
  searchParams,
}: FreeArticleEditorPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const data = await getFreeArticleEditorData(id);

  if (!data) {
    notFound();
  }

  const { draft, articles } = data;
  const saveAction = updateFreeArticleDraftAction.bind(null, draft.id);
  const errorMessage = getErrorMessage(error);
  const isPublished = draft.status === "PUBLISHED";
  const isImproving = draft.status === "IMPROVING";
  const lastImprovedLabel =
    draft.improvementCount > 0
      ? draft.updatedAt.toLocaleDateString("ja-JP")
      : "未実施";

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 text-zinc-950 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/free-articles"
              className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              Free Articlesへ戻る
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-zinc-500">無料記事エディタ</p>
              <StatusBadge status={draft.status} />
              {isPublished ? (
                <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  公開済み ✓
                </span>
              ) : null}
              {isImproving ? (
                <span className="inline-flex rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                  改善中
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-normal">
              {draft.title}
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              生成、編集、レビュー、コピー、note公開までをこの画面で進めます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyFreeArticleButton text={draft.fullDraft} />
            {isPublished && draft.publishedUrl ? (
              <a
                href={draft.publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                noteで開く
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.65fr)]">
          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-950">編集</h2>
            </div>
            <form action={saveAction} className="grid gap-5 p-5">
              {errorMessage ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
                  {errorMessage}
                </p>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-semibold text-zinc-700"
                  >
                    タイトル
                  </label>
                  <input
                    id="title"
                    name="title"
                    defaultValue={draft.title}
                    required
                    className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
                <div>
                  <label
                    htmlFor="theme"
                    className="block text-sm font-semibold text-zinc-700"
                  >
                    テーマ
                  </label>
                  <input
                    id="theme"
                    name="theme"
                    defaultValue={draft.theme}
                    required
                    className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="destinationArticleId"
                    className="block text-sm font-semibold text-zinc-700"
                  >
                    送客先Article
                  </label>
                  <select
                    id="destinationArticleId"
                    name="destinationArticleId"
                    defaultValue={draft.destinationArticleId ?? ""}
                    className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                  >
                    <option value="">送客先未設定</option>
                    {articles.map((article) => (
                      <option key={article.id} value={article.id}>
                        {article.title} / {article.price.toLocaleString("ja-JP")}円
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="searchIntent"
                    className="block text-sm font-semibold text-zinc-700"
                  >
                    検索意図
                  </label>
                  <input
                    id="searchIntent"
                    name="searchIntent"
                    defaultValue={draft.searchIntent}
                    className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="publishedUrl"
                  className="block text-sm font-semibold text-zinc-700"
                >
                  公開URL
                </label>
                <input
                  id="publishedUrl"
                  name="publishedUrl"
                  type="url"
                  placeholder="https://note.com/..."
                  defaultValue={draft.publishedUrl}
                  className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  下書き保存では公開済みにしません。公開確定時にこのURLを使います。
                </p>
              </div>

              <Field
                label="ターゲット"
                name="targetReader"
                defaultValue={draft.targetReader}
                rows={2}
              />
              <Field
                label="読者の悩み"
                name="readerProblem"
                defaultValue={draft.readerProblem}
                rows={2}
              />
              <Field
                label="記事の目的"
                name="purpose"
                defaultValue={draft.purpose}
                rows={2}
              />
              <Field
                label="導入文"
                name="introduction"
                defaultValue={draft.introduction}
                rows={5}
              />
              <Field
                label="見出し"
                name="headingsText"
                defaultValue={draft.headingsText}
                rows={6}
              />
              <Field label="本文全文" name="body" defaultValue={draft.body} rows={14} />
              <Field
                label="まとめ"
                name="summary"
                defaultValue={draft.summary}
                rows={5}
              />
              <Field label="CTA" name="cta" defaultValue={draft.cta} rows={5} />
              <Field
                label="完成原稿全文"
                name="fullDraft"
                defaultValue={draft.fullDraft}
                rows={20}
              />

              <button
                type="submit"
                className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                {isImproving ? "改善済みとして保存" : "保存"}
              </button>
            </form>
          </section>

          <aside className="grid gap-6">
            <PublishChecklist
              draftId={draft.id}
              isPublished={isPublished}
              hasPublishedUrl={Boolean(draft.publishedUrl)}
            />

            {draft.evaluation ? (
              <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-950">
                    改善提案
                  </h2>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                    {draft.evaluation.phaseLabel}
                  </span>
                  {shouldShowEvaluationScore(draft.evaluation) ? (
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${getPriorityClass(
                        draft.evaluation.priority,
                      )}`}
                    >
                      改善優先度 {draft.evaluation.priority}
                    </span>
                  ) : null}
                </div>
                {shouldShowEvaluationScore(draft.evaluation) ? (
                  <div className="mt-4 grid gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">改善理由</p>
                    <ul className="mt-2 grid gap-1 text-sm text-zinc-600">
                      {draft.evaluation.reasons.length > 0 ? (
                        draft.evaluation.reasons.map((reason) => (
                          <li key={reason}>・{reason}</li>
                        ))
                      ) : (
                        <li>・大きな改善リスクはありません</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">改善提案</p>
                    {draft.improvementSuggestions.length > 0 ? (
                      <div className="mt-2 grid gap-3">
                        {draft.improvementSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.category}
                            className="rounded-md bg-zinc-50 p-3 ring-1 ring-zinc-200"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-zinc-950">
                                {suggestion.category}
                              </p>
                              <span
                                className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${getPriorityClass(
                                  suggestion.priority,
                                )}`}
                              >
                                {suggestion.priority}
                              </span>
                            </div>
                            <p className="mt-2 text-xs font-medium text-zinc-500">
                              理由: {suggestion.reason}
                            </p>
                            <ul className="mt-2 grid gap-1 text-sm text-zinc-700">
                              {suggestion.actions.map((action) => (
                                <li key={action}>・{action}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">
                        今すぐ必要な改善提案はありません。
                      </p>
                    )}
                  </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-zinc-600">
                    {draft.evaluation.phaseLabel}のため、評価と改善提案はまだ表示しません。
                  </p>
                )}
              </section>
            ) : null}

            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-zinc-950">
                ステータス操作
              </h2>
              <div className="mt-4 grid gap-2">
                {draft.status === "READY" ? (
                  <form action={markFreeArticlePublishedAction} className="grid gap-2">
                    <input type="hidden" name="id" value={draft.id} />
                    <label
                      htmlFor="publishPublishedUrl"
                      className="text-sm font-semibold text-zinc-700"
                    >
                      公開URL
                    </label>
                    <input
                      id="publishPublishedUrl"
                      name="publishedUrl"
                      type="url"
                      placeholder="https://note.com/..."
                      defaultValue={draft.publishedUrl}
                      className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    />
                    <StatusActionButton>公開確定</StatusActionButton>
                  </form>
                ) : !isPublished ? (
                  <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600 ring-1 ring-zinc-200">
                    公開確定はReadyに進めたあとに実行できます。
                  </p>
                ) : null}
                {["DRAFT", "REVIEW", "READY", "IMPROVING", "ARCHIVED"].map(
                  (status) =>
                    status === "IMPROVING" && isPublished ? (
                      <form key={status} action={sendFreeArticleToImprovementAction}>
                        <input type="hidden" name="id" value={draft.id} />
                        <StatusActionButton>改善へ送る</StatusActionButton>
                      </form>
                    ) : status === "IMPROVING" ? null : status === "ARCHIVED" ? (
                      <form key={status} action={archiveFreeArticleAction}>
                        <input type="hidden" name="id" value={draft.id} />
                        <StatusActionButton>Archive</StatusActionButton>
                      </form>
                    ) : (
                      <form key={status} action={updateFreeArticleStatusAction}>
                        <input type="hidden" name="id" value={draft.id} />
                        <input type="hidden" name="status" value={status} />
                        <StatusActionButton>
                          {freeArticleStatusLabels[
                            status as keyof typeof freeArticleStatusLabels
                          ]}
                          へ進める
                        </StatusActionButton>
                      </form>
                    ),
                )}
              </div>
            </section>

            <section
              className={`rounded-lg border p-5 shadow-sm ${
                isPublished
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <h2 className="text-base font-semibold text-zinc-950">公開情報</h2>
              <div className="mt-4 grid gap-2 text-sm text-zinc-600">
                {isPublished ? (
                  <p className="font-semibold text-emerald-700">✅ 公開済み</p>
                ) : null}
                {isImproving ? (
                  <p className="font-semibold text-violet-700">改善中</p>
                ) : null}
                <p>公開日: {draft.publishedAt?.toLocaleDateString("ja-JP") ?? "未公開"}</p>
                <p className="break-all">公開URL: {draft.publishedUrl || "未設定"}</p>
                {isPublished && draft.publishedUrl ? (
                  <a
                    href={draft.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    noteで開く
                  </a>
                ) : null}
                <p>PV: {draft.publishedPv.toLocaleString("ja-JP")}</p>
                <p>送客数: {draft.referralCount.toLocaleString("ja-JP")}</p>
                <p>購入数: {draft.purchaseCount.toLocaleString("ja-JP")}</p>
                <div className="rounded-md bg-white/70 p-3 ring-1 ring-black/5">
                  <p className="font-semibold text-zinc-900">改善履歴</p>
                  <div className="mt-2 grid gap-1">
                    <p>改善回数: {draft.improvementCount.toLocaleString("ja-JP")}</p>
                    <p>最終改善日: {lastImprovedLabel}</p>
                    {isImproving ? (
                      <p>改善開始: {draft.updatedAt.toLocaleDateString("ja-JP")}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-5 py-4">
                <h2 className="text-base font-semibold text-zinc-950">
                  noteプレビュー
                </h2>
              </div>
              <article className="mx-auto max-w-[42rem] px-5 py-7">
                <h2 className="text-2xl font-bold leading-snug tracking-normal">
                  {draft.title}
                </h2>
                <div className="mt-6 whitespace-pre-wrap text-[15px] leading-8 text-zinc-800">
                  {draft.fullDraft}
                </div>
              </article>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
