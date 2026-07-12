import { prisma } from "@/lib/prisma";
import type { NoteAccessExtractedItem } from "./types";

export async function getArticlesForAccessImport() {
  return prisma.article.findMany({
    select: {
      id: true,
      title: true,
      pv: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function applyNoteAccessImport({
  fileCount,
  items,
}: {
  fileCount: number;
  items: Array<
    NoteAccessExtractedItem & {
      selectedArticleId: string | null;
      selectedPv: number;
    }
  >;
}) {
  return prisma.$transaction(async (transaction) => {
    const run = await transaction.articleAccessImportRun.create({
      data: {
        status: "completed",
        sourceFileCount: fileCount,
      },
      select: {
        id: true,
      },
    });
    const selectedArticleIds = Array.from(
      new Set(
        items
          .map((item) => item.selectedArticleId)
          .filter((articleId): articleId is string => Boolean(articleId)),
      ),
    );
    const articles =
      selectedArticleIds.length > 0
        ? await transaction.article.findMany({
            where: {
              id: {
                in: selectedArticleIds,
              },
            },
            select: {
              id: true,
              pv: true,
            },
          })
        : [];
    const articleById = new Map(articles.map((article) => [article.id, article]));

    let updatedArticles = 0;
    let warningItems = 0;
    let skippedItems = 0;

    for (const item of items) {
      const article = item.selectedArticleId
        ? articleById.get(item.selectedArticleId)
        : null;
      let status = "skipped";
      let warning = item.warning;
      let previousPv: number | null = null;
      let nextPv: number | null = null;

      if (!article) {
        skippedItems += 1;
        warning = warning ?? "Articleが選択されていないため、PV更新をスキップしました。";
      } else {
        previousPv = article.pv;
        nextPv = item.selectedPv;

        if (item.selectedPv < article.pv) {
          status = "warning_decrease";
          warning = `抽出PVが現在値 ${article.pv} より小さいため、Article.pvは更新していません。`;
          warningItems += 1;
        } else if (item.selectedPv === article.pv) {
          status = "unchanged";
        } else {
          await transaction.article.update({
            where: {
              id: article.id,
            },
            data: {
              pv: item.selectedPv,
            },
          });
          article.pv = item.selectedPv;
          status = "updated";
          updatedArticles += 1;
        }
      }

      await transaction.articleAccessImportItem.create({
        data: {
          runId: run.id,
          articleId: article?.id ?? null,
          sourceFileName: item.sourceFileName,
          extractedTitle: item.extractedTitle,
          extractedPv: item.selectedPv,
          previousPv,
          nextPv,
          status,
          warning,
          rawText: item.rawText,
        },
      });
    }

    return {
      runId: run.id,
      updatedArticles,
      warningItems,
      skippedItems,
      savedItems: items.length,
    };
  });
}
