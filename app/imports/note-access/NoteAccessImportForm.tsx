"use client";

import { type DragEvent, useRef, useState, useActionState } from "react";
import {
  previewNoteAccessImportAction,
  type NoteAccessImportActionState,
} from "./actions";
import NoteAccessImportPreview from "./NoteAccessImportPreview";

const initialState: NoteAccessImportActionState = {};

export default function NoteAccessImportForm() {
  const [state, formAction, isPending] = useActionState(
    previewNoteAccessImportAction,
    initialState,
  );
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function updateFileNames(files: FileList | null) {
    setFileNames(
      Array.from(files ?? []).map((file, index) => {
        const fileName = file.name && file.name !== "blob" ? file.name : `画像 ${index + 1}`;
        return file.type ? `${fileName} (${file.type})` : fileName;
      }),
    );
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!inputRef.current) {
      return;
    }

    inputRef.current.files = event.dataTransfer.files;
    updateFileNames(event.dataTransfer.files);
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <form action={formAction} className="grid gap-5">
          <label
            htmlFor="files"
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition ${
              isDragging
                ? "border-zinc-950 bg-zinc-100"
                : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100"
            }`}
          >
            <span className="text-sm font-semibold text-zinc-950">
              画像をドラッグ＆ドロップ
            </span>
            <span className="mt-2 text-sm text-zinc-500">
              PNG / JPEG / WebP を複数選択できます
            </span>
            <input
              ref={inputRef}
              id="files"
              name="files"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => updateFileNames(event.target.files)}
              className="sr-only"
            />
          </label>

          {fileNames.length > 0 ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-sm font-medium text-zinc-700">
                選択中の画像 {fileNames.length} 件
              </p>
              <ul className="mt-2 grid gap-1 text-sm text-zinc-600">
                {fileNames.map((fileName) => (
                  <li key={fileName}>{fileName}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {state.formError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-fit"
          >
            {isPending ? "OCR処理中" : "OCRしてプレビュー"}
          </button>
        </form>
      </section>

      <NoteAccessImportPreview preview={state.preview} result={state.result} />
    </div>
  );
}
