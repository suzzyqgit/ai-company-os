"use client";

import { useState } from "react";
import {
  getAutoCompletedPublishKeys,
  getPublishChecklistStorageKey,
  getPublishCompletionRate,
} from "@/features/free-articles/publishing";

type PublishCompletionRateProps = {
  draftId: string;
  isPublished: boolean;
  hasPublishedUrl: boolean;
};

function getInitialKeys({
  draftId,
  isPublished,
  hasPublishedUrl,
}: PublishCompletionRateProps) {
  const fallbackKeys = getAutoCompletedPublishKeys({
    isPublished,
    hasPublishedUrl,
  });

  if (typeof window === "undefined") {
    return fallbackKeys;
  }

  const savedValue = window.localStorage.getItem(
    getPublishChecklistStorageKey(draftId),
  );

  if (!savedValue) {
    return fallbackKeys;
  }

  try {
    const parsed = JSON.parse(savedValue);
    return Array.isArray(parsed) ? parsed.map(String) : fallbackKeys;
  } catch {
    return fallbackKeys;
  }
}

export default function PublishCompletionRate({
  draftId,
  isPublished,
  hasPublishedUrl,
}: PublishCompletionRateProps) {
  const [completedKeys] = useState<string[]>(() =>
    getInitialKeys({
      draftId,
      isPublished,
      hasPublishedUrl,
    }),
  );

  const completionRate = getPublishCompletionRate(completedKeys);
  const isComplete = completionRate === 100;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-900">公開完了率</p>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
            isComplete
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-amber-50 text-amber-700 ring-amber-200"
          }`}
        >
          {completionRate}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-full rounded-full ${
            isComplete ? "bg-emerald-500" : "bg-amber-500"
          }`}
          style={{ width: `${completionRate}%` }}
        />
      </div>
    </div>
  );
}
