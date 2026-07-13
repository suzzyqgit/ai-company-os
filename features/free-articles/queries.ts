import { prisma } from "@/lib/prisma";
import {
  freeArticlePipelineStatuses,
  getTodayFreeArticleStatusRank,
  normalizeFreeArticleStatus,
  type FreeArticlePipelineStatus,
} from "./status";

export type FreeArticlePipelineItem = {
  id: string;
  title: string;
  theme: string;
  category: string;
  status: FreeArticlePipelineStatus;
  createdAt: Date;
  updatedAt: Date;
  destinationArticle: {
    id: string;
    title: string;
  };
  destinationNoteUrl: string;
  fullDraft: string;
  duplicateScore: number;
  publishedAt: Date | null;
  publishedUrl: string;
  publishedPv: number;
  referralCount: number;
  purchaseCount: number;
  improvementCount: number;
};

export type FreeArticlePipelineKpis = {
  ideaCount: number;
  draftCount: number;
  reviewCount: number;
  readyCount: number;
  publishedCount: number;
};

export type FreeArticlePipelineData = {
  items: FreeArticlePipelineItem[];
  kpis: FreeArticlePipelineKpis;
};

function getCategory({
  searchIntent,
  funnelRole,
  theme,
}: {
  searchIntent?: string;
  funnelRole?: string;
  theme: string;
}) {
  return searchIntent || funnelRole || theme;
}

export async function getFreeArticlePipelineData(): Promise<FreeArticlePipelineData> {
  const drafts = await prisma.freeArticleDraft.findMany({
    include: {
      destinationArticle: {
        select: {
          id: true,
          title: true,
        },
      },
      freeArticleIdea: {
        select: {
          searchIntent: true,
          funnelRole: true,
          duplicateScore: true,
          titleSimilarityScore: true,
        },
      },
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        id: "asc",
      },
    ],
  });
  const items = drafts.map((draft) => {
    const status = normalizeFreeArticleStatus(draft.status);

    return {
      id: draft.id,
      title: draft.title,
      theme: draft.theme,
      category: getCategory({
        searchIntent: draft.freeArticleIdea?.searchIntent,
        funnelRole: draft.freeArticleIdea?.funnelRole,
        theme: draft.theme,
      }),
      status,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      destinationArticle: draft.destinationArticle,
      destinationNoteUrl: draft.destinationNoteUrl,
      fullDraft: draft.fullDraft,
      duplicateScore: Math.max(
        draft.freeArticleIdea?.duplicateScore ?? 0,
        draft.freeArticleIdea?.titleSimilarityScore ?? 0,
      ),
      publishedAt: draft.publishedAt,
      publishedUrl: draft.publishedUrl,
      publishedPv: draft.publishedPv,
      referralCount: draft.referralCount,
      purchaseCount: draft.purchaseCount,
      improvementCount: draft.improvementCount,
    } satisfies FreeArticlePipelineItem;
  });
  const kpis = items.reduce(
    (counts, item) => {
      if (item.status === "IDEA") {
        counts.ideaCount += 1;
      }

      if (item.status === "DRAFT") {
        counts.draftCount += 1;
      }

      if (item.status === "REVIEW") {
        counts.reviewCount += 1;
      }

      if (item.status === "READY") {
        counts.readyCount += 1;
      }

      if (item.status === "PUBLISHED") {
        counts.publishedCount += 1;
      }

      return counts;
    },
    {
      ideaCount: 0,
      draftCount: 0,
      reviewCount: 0,
      readyCount: 0,
      publishedCount: 0,
    },
  );

  return {
    items,
    kpis,
  };
}

export async function getFreeArticlePipelineDraftStatusByArticle(
  articleId: string,
) {
  const drafts = await prisma.freeArticleDraft.findMany({
    where: {
      destinationArticleId: articleId,
      status: {
        in: freeArticlePipelineStatuses.filter((status) => status !== "ARCHIVED"),
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
    },
    orderBy: [
      {
        id: "asc",
      },
    ],
  });
  const draft = drafts
    .map((item) => ({
      ...item,
      status: normalizeFreeArticleStatus(item.status),
    }))
    .filter((item) => item.status !== "ARCHIVED" && item.status !== "IDEA")
    .sort((left, right) => {
      const statusDiff =
        getTodayFreeArticleStatusRank(right.status) -
        getTodayFreeArticleStatusRank(left.status);

      if (statusDiff !== 0) {
        return statusDiff;
      }

      const updatedAtDiff = right.updatedAt.getTime() - left.updatedAt.getTime();

      if (updatedAtDiff !== 0) {
        return updatedAtDiff;
      }

      return left.id.localeCompare(right.id);
    })[0];

  if (!draft) {
    return null;
  }

  return draft;
}
