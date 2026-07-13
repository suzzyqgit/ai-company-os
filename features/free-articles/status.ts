export const freeArticlePipelineStatuses = [
  "IDEA",
  "DRAFT",
  "REVIEW",
  "READY",
  "PUBLISHED",
  "IMPROVING",
  "ARCHIVED",
] as const;

export type FreeArticlePipelineStatus = (typeof freeArticlePipelineStatuses)[number];

const statusSet = new Set<string>(freeArticlePipelineStatuses);
const allowedTransitions: Record<
  FreeArticlePipelineStatus,
  FreeArticlePipelineStatus[]
> = {
  IDEA: ["DRAFT", "ARCHIVED"],
  DRAFT: ["REVIEW", "ARCHIVED"],
  REVIEW: ["READY", "ARCHIVED"],
  READY: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["IMPROVING", "ARCHIVED"],
  IMPROVING: ["READY", "ARCHIVED"],
  ARCHIVED: [],
};
const todayStatusRank = {
  READY: 5,
  REVIEW: 4,
  DRAFT: 3,
  PUBLISHED: 2,
  IMPROVING: 1,
  IDEA: 0,
  ARCHIVED: -1,
} satisfies Record<FreeArticlePipelineStatus, number>;

export const freeArticleStatusLabels = {
  IDEA: "Idea",
  DRAFT: "Draft",
  REVIEW: "Review待ち",
  READY: "公開待ち",
  PUBLISHED: "公開済み",
  IMPROVING: "改善中",
  ARCHIVED: "Archive",
} satisfies Record<FreeArticlePipelineStatus, string>;

export function normalizeFreeArticleStatus(status: string): FreeArticlePipelineStatus {
  const normalized = status.trim().toUpperCase();

  if (normalized === "DRAFTING" || normalized === "DRAFTED") {
    return "DRAFT";
  }

  if (statusSet.has(normalized)) {
    return normalized as FreeArticlePipelineStatus;
  }

  return "DRAFT";
}

export function isFreeArticlePipelineStatus(
  value: string,
): value is FreeArticlePipelineStatus {
  return statusSet.has(value);
}

export function canTransitionFreeArticleStatus({
  from,
  to,
}: {
  from: string;
  to: FreeArticlePipelineStatus;
}) {
  const currentStatus = normalizeFreeArticleStatus(from);

  if (currentStatus === to) {
    return true;
  }

  return allowedTransitions[currentStatus].includes(to);
}

export function getTodayFreeArticleStatusRank(status: FreeArticlePipelineStatus) {
  return todayStatusRank[status];
}

export function isValidPublishedNoteUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "note.com";
  } catch {
    return false;
  }
}

export function getFreeArticleStatusClass(status: FreeArticlePipelineStatus) {
  if (status === "PUBLISHED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "READY") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "REVIEW") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (status === "IMPROVING") {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  if (status === "ARCHIVED") {
    return "bg-zinc-100 text-zinc-500 ring-zinc-200";
  }

  return "bg-zinc-50 text-zinc-700 ring-zinc-200";
}
