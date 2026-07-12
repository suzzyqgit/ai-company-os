"use client";

import { useActionState } from "react";
import {
  previewNoteProfileImportAction,
  type NoteProfileImportActionState,
} from "./actions";
import NoteProfileImportPreview from "./NoteProfileImportPreview";

const initialState: NoteProfileImportActionState = {};

export default function NoteProfileImportForm() {
  const [state, formAction, isPending] = useActionState(
    previewNoteProfileImportAction,
    initialState,
  );

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <form action={formAction} className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <label
              htmlFor="profileUrl"
              className="text-sm font-medium text-zinc-700"
            >
              noteプロフィールURL
            </label>
            <input
              id="profileUrl"
              name="profileUrl"
              type="url"
              defaultValue={state.preview?.profileUrl ?? "https://note.com/suzzysuzzy"}
              placeholder="https://note.com/suzzysuzzy"
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 lg:w-auto"
            >
              {isPending ? "取得中" : "公開記事を取得"}
            </button>
          </div>
        </form>
        {state.formError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {state.formError}
          </div>
        ) : null}
      </section>

      <NoteProfileImportPreview preview={state.preview} result={state.result} />
    </div>
  );
}
