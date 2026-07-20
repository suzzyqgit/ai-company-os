import { revalidatePath } from "next/cache";

function revalidatePaths(paths: Iterable<string>) {
  new Set(paths).forEach((path) => {
    revalidatePath(path);
  });
}

function articleDetailPaths(articleIds: Iterable<string>, includeEdit = false) {
  return Array.from(articleIds).flatMap((articleId) => [
    `/articles/${articleId}`,
    ...(includeEdit ? [`/articles/${articleId}/edit`] : []),
  ]);
}

export function revalidateArticleData(articleIds: Iterable<string> = []) {
  revalidatePaths([
    "/",
    "/articles",
    "/analytics",
    "/today",
    "/content-gap",
    "/ai-improvements",
    ...articleDetailPaths(articleIds),
  ]);
}

export function revalidateArticleFormData(
  articleIds: Iterable<string> = [],
  { includeEdit = false }: { includeEdit?: boolean } = {},
) {
  revalidatePaths([
    "/articles",
    "/free-article-generator",
    ...articleDetailPaths(articleIds, includeEdit),
  ]);
}

export function revalidateDailyMetrics(articleIds: Iterable<string> = []) {
  revalidatePaths([
    "/",
    "/articles",
    "/analytics",
    "/metrics/daily",
    "/today",
    "/content-gap",
    "/ai-improvements",
    ...articleDetailPaths(articleIds),
  ]);
}

export function revalidateSalesImport(articleIds: Iterable<string> = []) {
  revalidateDailyMetrics(articleIds);
}

export function revalidateAccessImport(articleIds: Iterable<string> = []) {
  revalidatePaths([
    "/",
    "/articles",
    "/analytics",
    "/today",
    "/content-gap",
    "/ai-improvements",
    "/free-article-generator",
    ...articleDetailPaths(articleIds, true),
  ]);
}

export function revalidateNoteProfileImport(articleIds: Iterable<string> = []) {
  revalidatePaths([
    "/",
    "/articles",
    "/analytics",
    "/today",
    "/content-gap",
    "/ai-improvements",
    "/free-article-generator",
    ...articleDetailPaths(articleIds, true),
  ]);
}

export function revalidateFreeArticleGenerator() {
  revalidatePaths(["/free-article-generator"]);
}

export function revalidateFreeArticlePipeline(draftIds: Iterable<string> = []) {
  revalidatePaths([
    "/",
    "/free-articles",
    "/free-article-generator",
    "/content-gap",
    "/ai-improvements",
    "/today",
    ...Array.from(draftIds).map((draftId) => `/free-articles/${draftId}`),
  ]);
}

export function revalidateAiAnalysis(articleId: string) {
  revalidatePaths([
    `/articles/${articleId}`,
    "/ai-improvements",
    "/today",
    "/content-gap",
  ]);
}

export function revalidateToday() {
  revalidatePaths(["/today"]);
}

export function revalidateProductionMigration() {
  revalidatePaths([
    "/",
    "/articles",
    "/analytics",
    "/today",
    "/content-gap",
    "/ai-improvements",
    "/production-migration",
  ]);
}
