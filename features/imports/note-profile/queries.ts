import { prisma } from "@/lib/prisma";
import type { NoteProfileArticle } from "./types";

export async function getArticlesForNoteProfileMatching() {
  return prisma.article.findMany({
    select: {
      id: true,
      title: true,
      noteUrl: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function applyNoteProfileImport({
  publicArticles,
  selectedExistingUpdates,
  selectedMissingNoteUrls,
}: {
  publicArticles: NoteProfileArticle[];
  selectedExistingUpdates: Array<{ articleId: string; noteUrl: string }>;
  selectedMissingNoteUrls: string[];
}) {
  return prisma.$transaction(async (transaction) => {
    const selectedExistingByArticleId = new Map(
      selectedExistingUpdates.map((update) => [update.articleId, update.noteUrl]),
    );
    const selectedMissingSet = new Set(selectedMissingNoteUrls);
    const articles = await transaction.article.findMany({
      select: {
        id: true,
        title: true,
        noteUrl: true,
      },
    });
    const articleByTitle = new Map(articles.map((article) => [article.title, article]));
    const articleByNoteUrl = new Map(
      articles
        .filter((article) => article.noteUrl.trim() !== "")
        .map((article) => [article.noteUrl, article]),
    );

    let updatedArticles = 0;
    let createdArticles = 0;
    let skippedArticles = 0;

    for (const [articleId, noteUrl] of selectedExistingByArticleId) {
      const currentArticle = articles.find((article) => article.id === articleId);
      const publicArticle = publicArticles.find(
        (candidate) => candidate.noteUrl === noteUrl,
      );

      if (!currentArticle || !publicArticle) {
        skippedArticles += 1;
        continue;
      }

      if (currentArticle.noteUrl !== noteUrl) {
        await transaction.article.update({
          where: {
            id: articleId,
          },
          data: {
            noteUrl,
          },
        });
        updatedArticles += 1;
        currentArticle.noteUrl = noteUrl;
      }
    }

    for (const publicArticle of publicArticles) {
      const exactArticle = articleByTitle.get(publicArticle.title);
      const urlArticle = articleByNoteUrl.get(publicArticle.noteUrl);

      if (!selectedMissingSet.has(publicArticle.noteUrl)) {
        continue;
      }

      if (urlArticle) {
        skippedArticles += 1;
        continue;
      }

      if (exactArticle) {
        if (exactArticle.noteUrl !== publicArticle.noteUrl) {
          await transaction.article.update({
            where: {
              id: exactArticle.id,
            },
            data: {
              noteUrl: publicArticle.noteUrl,
            },
          });
          updatedArticles += 1;
        }
        continue;
      }

      const created = await transaction.article.create({
        data: {
          title: publicArticle.title,
          noteUrl: publicArticle.noteUrl,
          status: "active",
          price: publicArticle.price,
          pv: 0,
          purchases: 0,
          baselinePv: 0,
          baselinePurchases: 0,
          note: "",
        },
        select: {
          id: true,
          title: true,
          noteUrl: true,
        },
      });

      articleByTitle.set(created.title, created);
      articleByNoteUrl.set(created.noteUrl, created);
      createdArticles += 1;
    }

    return {
      updatedArticles,
      createdArticles,
      skippedArticles,
    };
  });
}
