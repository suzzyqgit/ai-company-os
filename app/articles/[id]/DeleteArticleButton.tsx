"use client";

import { useActionState, useState } from "react";
import type { DeleteArticleActionState } from "../actions";

type DeleteArticleButtonProps = {
  action: (
    previousState: DeleteArticleActionState,
  ) => Promise<DeleteArticleActionState>;
  articleTitle: string;
};

export default function DeleteArticleButton({
  action,
  articleTitle,
}: DeleteArticleButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [actionState, formAction, isPending] = useActionState(action, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setIsDialogOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-md border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 sm:mt-1"
      >
        削除
      </button>

      {isDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-article-title"
        >
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-xl">
            <h2
              id="delete-article-title"
              className="text-lg font-semibold text-zinc-950"
            >
              記事を削除しますか？
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              「{articleTitle}」を削除します。この操作は取り消せません。
            </p>

            {actionState.formError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {actionState.formError}
              </div>
            ) : null}

            <form action={formAction} className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                disabled={isPending}
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {isPending ? "削除中" : "削除する"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
