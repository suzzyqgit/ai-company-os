"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { TodayChecklistItem, TodayTaskKey } from "@/features/today/calculators";
import { updateTodayTaskCompletionAction } from "./actions";

type TodayChecklistProps = {
  items: TodayChecklistItem[];
};

export default function TodayChecklist({ items }: TodayChecklistProps) {
  const [checklistItems, setChecklistItems] = useState(items);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<TodayTaskKey | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateItem(key: TodayTaskKey, completed: boolean) {
    setChecklistItems((currentItems) =>
      currentItems.map((item) =>
        item.key === key
          ? {
              ...item,
              completed,
            }
          : item,
      ),
    );
  }

  return (
    <div className="grid gap-3">
      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
      {checklistItems.map((item) => (
        <label
          key={item.key}
          className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm"
        >
          <span className="flex min-w-0 items-center gap-3">
            <input
              type="checkbox"
              checked={item.completed}
              disabled={pendingKey !== null || isPending}
              onChange={(event) => {
                const completed = event.currentTarget.checked;
                const previousCompleted = item.completed;
                const formData = new FormData();
                formData.set("taskKey", item.key);
                formData.set("completed", String(completed));

                startTransition(() => {
                  setErrorMessage(null);
                  setPendingKey(item.key);
                  updateItem(item.key, completed);

                  void updateTodayTaskCompletionAction(formData).then((result) => {
                    if (!result.ok) {
                      updateItem(item.key, previousCompleted);
                      setErrorMessage(result.error);
                    }

                    setPendingKey(null);
                  });
                });
              }}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-950"
            />
            <span
              className={
                item.completed
                  ? "truncate text-zinc-400 line-through"
                  : "truncate text-zinc-800"
              }
            >
              {item.label}
              {pendingKey === item.key ? (
                <span className="ml-2 text-xs text-zinc-400">保存中</span>
              ) : null}
            </span>
          </span>
          <Link
            href={item.href}
            className="shrink-0 text-xs font-semibold text-zinc-500 underline-offset-4 hover:text-zinc-950 hover:underline"
          >
            開く
          </Link>
        </label>
      ))}
    </div>
  );
}
