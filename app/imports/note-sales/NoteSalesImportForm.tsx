"use client";

import { useActionState, useRef, useState } from "react";
import {
  previewNoteSalesImportAction,
  type NoteSalesImportActionState,
} from "./actions";
import NoteSalesImportPreview from "./NoteSalesImportPreview";

const initialState: NoteSalesImportActionState = {};

export default function NoteSalesImportForm() {
  const [state, formAction, isPending] = useActionState(
    previewNoteSalesImportAction,
    initialState,
  );
  const [fileNames, setFileNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">
            CSVアップロード
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            noteから出力した販売履歴CSVを選択してください。複数ファイルをまとめて解析できます。
          </p>
        </div>

        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const files = Array.from(event.dataTransfer.files);
            const input = inputRef.current;

            if (!input) {
              return;
            }

            const dataTransfer = new DataTransfer();
            files.forEach((file) => dataTransfer.items.add(file));
            input.files = dataTransfer.files;
            setFileNames(files.map((file) => file.name));
          }}
          className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center transition hover:border-zinc-500 hover:bg-zinc-100"
        >
          <span className="text-sm font-semibold text-zinc-950">
            CSVをドラッグ&ドロップ、またはクリックして選択
          </span>
          <span className="mt-2 text-xs text-zinc-500">
            1ファイル5MB、合計20MBまで
          </span>
          <input
            ref={inputRef}
            type="file"
            name="files"
            accept=".csv,text/csv"
            multiple
            className="sr-only"
            onChange={(event) => {
              setFileNames(
                Array.from(event.currentTarget.files ?? []).map((file) => file.name),
              );
            }}
          />
        </label>

        {fileNames.length > 0 ? (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <p className="font-medium text-zinc-950">選択中のファイル</p>
            <ul className="mt-2 grid gap-1">
              {fileNames.map((fileName) => (
                <li key={fileName}>{fileName}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.formError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {state.formError}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isPending ? "解析中" : "CSVを解析する"}
          </button>
        </div>
      </form>

      <NoteSalesImportPreview preview={state.preview} result={state.result} />
    </div>
  );
}
