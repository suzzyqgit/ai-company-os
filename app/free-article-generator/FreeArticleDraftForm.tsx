"use client";

import { useActionState, useMemo, useState } from "react";
import {
  generateFreeArticleCandidatesAction,
  saveSelectedFreeArticleDraftAction,
  type FreeArticleGeneratorActionState,
  type FreeArticleSaveActionState,
} from "./actions";
import CopyDraftButton from "./CopyDraftButton";

type ArticleOption = {
  id: string;
  title: string;
  noteUrl: string;
  price: number;
};

type FreeArticleDraftFormProps = {
  articles: ArticleOption[];
  defaultArticleId?: string;
  focusCategory?: string;
};

const generatorInitialState: FreeArticleGeneratorActionState = {};
const saveInitialState: FreeArticleSaveActionState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-medium text-red-600">{message}</p>;
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const colorClass =
    value >= 80
      ? "bg-red-50 text-red-700 ring-red-200"
      : value >= 50
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${colorClass}`}
    >
      {label}: {value}%
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colorClass =
    priority === "高"
      ? "bg-red-50 text-red-700 ring-red-200"
      : priority === "中"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${colorClass}`}
    >
      優先度: {priority}
    </span>
  );
}

export default function FreeArticleDraftForm({
  articles,
  defaultArticleId = "",
  focusCategory = "",
}: FreeArticleDraftFormProps) {
  const [intentFilter, setIntentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [duplicateFilter, setDuplicateFilter] = useState("all");
  const [sortKey, setSortKey] = useState("recommended");
  const [generatorState, generatorAction, isGenerating] = useActionState(
    generateFreeArticleCandidatesAction,
    generatorInitialState,
  );
  const [saveState, saveAction, isSaving] = useActionState(
    saveSelectedFreeArticleDraftAction,
    saveInitialState,
  );
  const result = generatorState.result;
  const ideas = useMemo(() => result?.ideas ?? [], [result?.ideas]);
  const searchIntentOptions = [...new Set(ideas.map((idea) => idea.searchIntent))];
  const funnelRoleOptions = [...new Set(ideas.map((idea) => idea.funnelRole))];
  const priorityOptions = ["高", "中", "低"].filter((priority) =>
    ideas.some((idea) => idea.priority === priority),
  );
  const filteredIdeas = useMemo(() => {
    return ideas
      .filter((idea) => intentFilter === "all" || idea.searchIntent === intentFilter)
      .filter((idea) => roleFilter === "all" || idea.funnelRole === roleFilter)
      .filter((idea) => priorityFilter === "all" || idea.priority === priorityFilter)
      .filter((idea) => {
        if (duplicateFilter === "low") {
          return idea.duplicateScore < 40 && idea.titleSimilarityScore < 40;
        }

        if (duplicateFilter === "medium") {
          return (
            Math.max(idea.duplicateScore, idea.titleSimilarityScore) >= 40 &&
            Math.max(idea.duplicateScore, idea.titleSimilarityScore) < 70
          );
        }

        if (duplicateFilter === "high") {
          return Math.max(idea.duplicateScore, idea.titleSimilarityScore) >= 70;
        }

        return true;
      })
      .sort((left, right) => {
        if (sortKey === "lowDuplicate") {
          return (
            Math.max(left.duplicateScore, left.titleSimilarityScore) -
            Math.max(right.duplicateScore, right.titleSimilarityScore)
          );
        }

        if (sortKey === "strongCta") {
          const score = (role: string) =>
            role === "980円記事への送客"
              ? 3
              : role === "購入前教育"
                ? 2
                : role === "比較検討"
                  ? 1
                  : 0;
          return score(right.funnelRole) - score(left.funnelRole);
        }

        const priorityScore = (priority: string) =>
          priority === "高" ? 3 : priority === "中" ? 2 : 1;
        return (
          priorityScore(right.priority) - priorityScore(left.priority) ||
          Math.max(left.duplicateScore, left.titleSimilarityScore) -
            Math.max(right.duplicateScore, right.titleSimilarityScore)
        );
      });
  }, [duplicateFilter, ideas, intentFilter, priorityFilter, roleFilter, sortKey]);

  return (
    <div className="grid gap-6">
      <form action={generatorAction} className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-950">
            送客先Articleから無料記事候補を生成
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            送客先Articleの実績と内容から逆算し、無料記事から980円記事へ進む導線を作ります。
          </p>
        </div>
        <div className="grid gap-5 p-5">
          <div>
            <label
              htmlFor="destinationArticleId"
              className="block text-sm font-medium text-zinc-700"
            >
              送客先Article
            </label>
            <select
              id="destinationArticleId"
              name="destinationArticleId"
              required
              defaultValue={defaultArticleId}
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="">選択してください</option>
              {articles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title} / {article.price.toLocaleString("ja-JP")}円
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-zinc-500">
              noteUrlが未設定の記事は、CTAを作れないため候補生成を拒否します。
            </p>
            <FieldError message={generatorState.fieldErrors?.destinationArticleId} />
          </div>

          {focusCategory ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Content Gapから「{focusCategory}」不足を引き継いでいます。このカテゴリを優先して候補を生成します。
            </div>
          ) : null}
          <input type="hidden" name="focusCategory" value={focusCategory} />

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="ctaStrength"
                className="block text-sm font-medium text-zinc-700"
              >
                CTAの強さ
              </label>
              <select
                id="ctaStrength"
                name="ctaStrength"
                defaultValue="standard"
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="soft">弱め</option>
                <option value="standard">標準</option>
                <option value="strong">強め</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="expectedLength"
                className="block text-sm font-medium text-zinc-700"
              >
                想定文字数
              </label>
              <input
                id="expectedLength"
                name="expectedLength"
                type="number"
                min="1"
                defaultValue="1800"
                required
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
              <FieldError message={generatorState.fieldErrors?.expectedLength} />
            </div>
            <div>
              <label htmlFor="tone" className="block text-sm font-medium text-zinc-700">
                トーン
              </label>
              <select
                id="tone"
                name="tone"
                defaultValue="practical"
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="practical">実践的</option>
                <option value="friendly">やさしい</option>
                <option value="serious">信頼感重視</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="memo" className="block text-sm font-medium text-zinc-700">
              補足メモ
            </label>
            <textarea
              id="memo"
              name="memo"
              rows={3}
              className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          {generatorState.formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {generatorState.formError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-fit"
          >
            {isGenerating ? "候補生成中" : "無料記事候補を20件生成"}
          </button>
        </div>
      </form>

      {result ? (
        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">送客先</p>
                <h2 className="mt-1 text-lg font-bold text-zinc-950">
                  {result.destinationArticle.title}
                </h2>
                <a
                  href={result.destinationArticle.noteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block break-all text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
                >
                  {result.destinationArticle.noteUrl}
                </a>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-zinc-600 sm:grid-cols-4">
                <span>PV: {result.destinationArticle.pv.toLocaleString("ja-JP")}</span>
                <span>
                  購入: {result.destinationArticle.purchases.toLocaleString("ja-JP")}
                </span>
                <span>
                  CVR: {result.destinationArticle.conversionRate.toFixed(1)}%
                </span>
                <span>状態: {result.destinationArticle.status}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-zinc-200 p-5 lg:grid-cols-5">
            <div>
              <label htmlFor="intentFilter" className="block text-xs font-semibold text-zinc-500">
                検索意図
              </label>
              <select
                id="intentFilter"
                value={intentFilter}
                onChange={(event) => setIntentFilter(event.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
              >
                <option value="all">すべて</option>
                {searchIntentOptions.map((intent) => (
                  <option key={intent} value={intent}>
                    {intent}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="roleFilter" className="block text-xs font-semibold text-zinc-500">
                導線上の役割
              </label>
              <select
                id="roleFilter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
              >
                <option value="all">すべて</option>
                {funnelRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="priorityFilter"
                className="block text-xs font-semibold text-zinc-500"
              >
                優先度
              </label>
              <select
                id="priorityFilter"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
              >
                <option value="all">すべて</option>
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="duplicateFilter"
                className="block text-xs font-semibold text-zinc-500"
              >
                重複率
              </label>
              <select
                id="duplicateFilter"
                value={duplicateFilter}
                onChange={(event) => setDuplicateFilter(event.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
              >
                <option value="all">すべて</option>
                <option value="low">低い</option>
                <option value="medium">中程度</option>
                <option value="high">高い</option>
              </select>
            </div>
            <div>
              <label htmlFor="sortKey" className="block text-xs font-semibold text-zinc-500">
                並び順
              </label>
              <select
                id="sortKey"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
                className="mt-2 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
              >
                <option value="recommended">おすすめ順</option>
                <option value="lowDuplicate">重複率が低い順</option>
                <option value="strongCta">送客意図が強い順</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-950">
                  無料記事候補20件
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  表示中 {filteredIdeas.length} 件。採用すると構成・本文・CTAを生成して保存します。
                </p>
              </div>
            </div>

            {saveState.formError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {saveState.formError}
              </div>
            ) : null}

            <div className="grid gap-3">
              {filteredIdeas.map((idea) => (
                <article
                  key={idea.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <PriorityBadge priority={idea.priority} />
                        <ScoreBadge label="重複率" value={idea.duplicateScore} />
                        <ScoreBadge
                          label="タイトル類似率"
                          value={idea.titleSimilarityScore}
                        />
                      </div>
                      <h4 className="mt-3 text-base font-bold text-zinc-950">
                        {idea.title}
                      </h4>
                      <p className="mt-2 text-sm font-medium text-zinc-700">
                        テーマ: {idea.theme}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                        <p>検索意図: {idea.searchIntent}</p>
                        <p>想定読者: {idea.targetReader}</p>
                        <p>読者の悩み: {idea.readerProblem}</p>
                        <p>切り口: {idea.angle}</p>
                        <p>導線上の役割: {idea.funnelRole}</p>
                        <p>期待CTA: {idea.expectedCta}</p>
                      </div>
                    </div>
                    <form action={saveAction} className="shrink-0">
                      <input type="hidden" name="ideaId" value={idea.id} />
                      <input type="hidden" name="ctaStrength" value={result.ctaStrength} />
                      <input
                        type="hidden"
                        name="expectedLength"
                        value={result.expectedLength}
                      />
                      <input type="hidden" name="tone" value={result.tone} />
            <input type="hidden" name="memo" value={result.memo} />
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 lg:w-auto"
                      >
                        {isSaving ? "保存中" : "採用して下書き生成"}
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {saveState.result ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">保存済み原稿</p>
              <h2 className="mt-2 text-lg font-bold text-zinc-950">
                {saveState.result.title}
              </h2>
            </div>
            <CopyDraftButton text={saveState.result.fullDraft} />
          </div>
          <div className="mt-5 grid gap-4 text-sm text-zinc-700 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold text-zinc-950">記事構成</h3>
              <pre className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6">
                {saveState.result.outline}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-950">note貼り付け用完成原稿</h3>
              <textarea
                readOnly
                value={saveState.result.fullDraft}
                rows={18}
                className="mt-2 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-800"
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
