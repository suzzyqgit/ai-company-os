"use client";

import { useState } from "react";
import {
  getAutoCompletedPublishKeys,
  getPublishChecklistStorageKey,
  getPublishCompletionRate,
  publishChecklistItems,
  type PublishChecklistKey,
} from "@/features/free-articles/publishing";

type PublishChecklistProps = {
  draftId: string;
  isPublished: boolean;
  hasPublishedUrl: boolean;
};

function getFallbackKeys({
  draftId,
  isPublished,
  hasPublishedUrl,
}: PublishChecklistProps) {
  const fallbackKeys = getAutoCompletedPublishKeys({
    isPublished,
    hasPublishedUrl,
  });

  if (typeof window === "undefined") {
    return fallbackKeys;
  }

  const storageKey = getPublishChecklistStorageKey(draftId);
  const savedValue = window.localStorage.getItem(storageKey);

  if (!savedValue) {
    return fallbackKeys;
  }

  try {
    const parsed = JSON.parse(savedValue);
    const validKeys = new Set<string>(
      publishChecklistItems.map((item) => item.key),
    );

    return Array.isArray(parsed)
      ? parsed
          .map(String)
          .filter((key): key is PublishChecklistKey => validKeys.has(key))
      : fallbackKeys;
  } catch {
    return fallbackKeys;
  }
}

export default function PublishChecklist({
  draftId,
  isPublished,
  hasPublishedUrl,
}: PublishChecklistProps) {
  const [completedKeys, setCompletedKeys] = useState<PublishChecklistKey[]>(() =>
    getFallbackKeys({
      draftId,
      isPublished,
      hasPublishedUrl,
    }),
  );

  function updateCompletedKeys(nextKeys: PublishChecklistKey[]) {
    setCompletedKeys(nextKeys);
    window.localStorage.setItem(
      getPublishChecklistStorageKey(draftId),
      JSON.stringify(nextKeys),
    );
  }

  function toggleItem(key: PublishChecklistKey) {
    const completedSet = new Set(completedKeys);

    if (completedSet.has(key)) {
      completedSet.delete(key);
    } else {
      completedSet.add(key);
    }

    updateCompletedKeys([...completedSet]);
  }

  const completionRate = getPublishCompletionRate(completedKeys);
  const isComplete = completionRate === 100;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">
            公開チェックリスト
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            noteへ公開する直前の作業をこの画面で確認します。
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
            isComplete
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-amber-50 text-amber-700 ring-amber-200"
          }`}
        >
          {completionRate}%
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-full rounded-full ${
            isComplete ? "bg-emerald-500" : "bg-amber-500"
          }`}
          style={{ width: `${completionRate}%` }}
        />
      </div>
      <div className="mt-4 grid gap-2">
        {publishChecklistItems.map((item) => (
          <label
            key={item.key}
            className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700"
          >
            <input
              type="checkbox"
              checked={completedKeys.includes(item.key)}
              onChange={() => toggleItem(item.key)}
              className="size-4 rounded border-zinc-300 text-zinc-950"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      {isComplete ? (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
          公開完了率 100%
        </p>
      ) : null}
    </section>
  );
}
