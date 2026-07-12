import { prisma } from "@/lib/prisma";

export async function getFreeArticleGeneratorArticles() {
  return prisma.article.findMany({
    where: {
      status: "active",
      noteUrl: {
        not: "",
      },
    },
    select: {
      id: true,
      title: true,
      noteUrl: true,
      price: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getFreeArticleGenerationHistory() {
  const [drafts, articles] = await Promise.all([
    prisma.freeArticleDraft.findMany({
      select: {
        title: true,
        theme: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.article.findMany({
      select: {
        title: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  return {
    draftTitles: drafts.map((draft) => draft.title),
    draftThemes: drafts.map((draft) => draft.theme),
    articleTitles: articles.map((article) => article.title),
  };
}

export async function getRecentFreeArticleDrafts() {
  return prisma.freeArticleDraft.findMany({
    select: {
      id: true,
      title: true,
      theme: true,
      status: true,
      createdAt: true,
      destinationArticle: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });
}

export async function getDuplicateWarningCandidates(theme: string, title: string) {
  const normalizedTheme = theme.trim();
  const normalizedTitle = title.trim();
  const duplicateConditions = [
    normalizedTheme
      ? {
          theme: {
            contains: normalizedTheme,
          },
        }
      : null,
    normalizedTitle
      ? {
          title: {
            contains: normalizedTitle,
          },
        }
      : null,
  ].filter((condition) => condition !== null);

  if (duplicateConditions.length === 0) {
    return [];
  }

  return prisma.freeArticleDraft.findMany({
    where: {
      OR: duplicateConditions,
    },
    select: {
      id: true,
      title: true,
      theme: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });
}
