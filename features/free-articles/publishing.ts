export const publishChecklistItems = [
  { key: "thumbnail", label: "サムネイル作成" },
  { key: "paste-to-note", label: "noteへ貼り付け" },
  { key: "tags", label: "タグ確認" },
  { key: "cta", label: "CTA確認" },
  { key: "publish", label: "公開" },
  { key: "url", label: "URL登録" },
] as const;

export type PublishChecklistKey = (typeof publishChecklistItems)[number]["key"];

export function getPublishChecklistStorageKey(draftId: string) {
  return `note-tools:free-article-publish-checklist:${draftId}`;
}

export function getPublishCompletionRate(completedKeys: Iterable<string>) {
  const completedSet = new Set(completedKeys);
  const completedCount = publishChecklistItems.filter((item) =>
    completedSet.has(item.key),
  ).length;

  return Math.round((completedCount / publishChecklistItems.length) * 100);
}

export function getAutoCompletedPublishKeys({
  isPublished,
  hasPublishedUrl,
}: {
  isPublished: boolean;
  hasPublishedUrl: boolean;
}) {
  const keys: PublishChecklistKey[] = [];

  if (isPublished) {
    keys.push("publish");
  }

  if (hasPublishedUrl) {
    keys.push("url");
  }

  return keys;
}
