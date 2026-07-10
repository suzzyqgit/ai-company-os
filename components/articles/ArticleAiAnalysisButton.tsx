"use client";

import { useActionState } from "react";
import type { ArticleAiAnalysisActionState } from "@/features/ai/actions";

type ArticleAiAnalysisButtonProps = {
  action: (
    previousState: ArticleAiAnalysisActionState,
  ) => Promise<ArticleAiAnalysisActionState>;
};

export default function ArticleAiAnalysisButton({
  action,
}: ArticleAiAnalysisButtonProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isPending ? "AI分析中" : "AI改善レポートを生成"}
      </button>

      {state.message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {state.message}
          {state.cached ? "（キャッシュ利用）" : null}
        </p>
      ) : null}

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
