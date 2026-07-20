import { prisma } from "@/lib/prisma";
import { stripLeadingMarkdownH1 } from "@/features/free-article-generator/generator";
import {
  evaluateFreeArticle,
  type FreeArticleEvaluation,
} from "./evaluation";
import {
  generateFreeArticleImprovementSuggestions,
  type FreeArticleImprovementSuggestion,
} from "./improvements";
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
  } | null;
  destinationNoteUrl: string;
  fullDraft: string;
  duplicateScore: number;
  publishedAt: Date | null;
  publishedUrl: string;
  publishedPv: number;
  referralCount: number;
  purchaseCount: number;
  improvementCount: number;
  evaluation: FreeArticleEvaluation | null;
  improvementSuggestions: FreeArticleImprovementSuggestion[];
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

export type FreeArticleEditorDraft = {
  id: string;
  freeArticleIdeaId: string | null;
  title: string;
  theme: string;
  searchIntent: string;
  targetReader: string;
  readerProblem: string;
  purpose: string;
  destinationArticleId: string | null;
  destinationNoteUrl: string;
  titleIdeas: string;
  outline: string;
  body: string;
  introduction: string;
  headingsText: string;
  summary: string;
  cta: string;
  fullDraft: string;
  status: FreeArticlePipelineStatus;
  publishedAt: Date | null;
  publishedUrl: string;
  publishedPv: number;
  referralCount: number;
  purchaseCount: number;
  improvementCount: number;
  evaluation: FreeArticleEvaluation | null;
  improvementSuggestions: FreeArticleImprovementSuggestion[];
  createdAt: Date;
  updatedAt: Date;
  destinationArticle: {
    id: string;
    title: string;
    noteUrl: string;
  } | null;
};

export type FreeArticleEditorArticle = {
  id: string;
  title: string;
  noteUrl: string;
  price: number;
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

function parseHeadingsText(value: string) {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.map((heading) => String(heading)).join("\n");
    }
  } catch {
    return value;
  }

  return value;
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
    const evaluation =
      status === "PUBLISHED"
        ? evaluateFreeArticle({
            id: draft.id,
            title: draft.title,
            publishedPv: draft.publishedPv,
            referralCount: draft.referralCount,
            purchaseCount: draft.purchaseCount,
            improvementCount: draft.improvementCount,
            publishedAt: draft.publishedAt,
            updatedAt: draft.updatedAt,
          })
        : null;

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
      fullDraft: stripLeadingMarkdownH1(draft.fullDraft),
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
      evaluation,
      improvementSuggestions: evaluation
        ? generateFreeArticleImprovementSuggestions({
            id: draft.id,
            title: draft.title,
            publishedPv: draft.publishedPv,
            referralCount: draft.referralCount,
            purchaseCount: draft.purchaseCount,
            improvementCount: draft.improvementCount,
            publishedAt: draft.publishedAt,
            updatedAt: draft.updatedAt,
            evaluation,
          })
        : [],
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
      improvementCount: true,
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

      if (left.status === "PUBLISHED" && right.status === "PUBLISHED") {
        const improvementDiff = left.improvementCount - right.improvementCount;

        if (improvementDiff !== 0) {
          return improvementDiff;
        }
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

export async function getFreeArticleEditorData(id: string) {
  const [draft, articles] = await Promise.all([
    prisma.freeArticleDraft.findUnique({
      where: {
        id,
      },
      include: {
        destinationArticle: {
          select: {
            id: true,
            title: true,
            noteUrl: true,
          },
        },
        freeArticleIdea: {
          select: {
            searchIntent: true,
          },
        },
      },
    }),
    prisma.article.findMany({
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
    }),
  ]);

  if (!draft) {
    return null;
  }
  const status = normalizeFreeArticleStatus(draft.status);
  const evaluation =
    status === "PUBLISHED"
      ? evaluateFreeArticle({
          id: draft.id,
          title: draft.title,
          publishedPv: draft.publishedPv,
          referralCount: draft.referralCount,
          purchaseCount: draft.purchaseCount,
          improvementCount: draft.improvementCount,
          publishedAt: draft.publishedAt,
          updatedAt: draft.updatedAt,
        })
      : null;

  return {
    draft: {
      id: draft.id,
      freeArticleIdeaId: draft.freeArticleIdeaId,
      title: draft.title,
      theme: draft.theme,
      searchIntent: draft.freeArticleIdea?.searchIntent ?? "",
      targetReader: draft.targetReader,
      readerProblem: draft.readerProblem,
      purpose: draft.purpose,
      destinationArticleId: draft.destinationArticleId,
      destinationNoteUrl: draft.destinationNoteUrl,
      titleIdeas: draft.titleIdeas,
      outline: draft.outline,
      body: draft.body,
      introduction: draft.introduction,
      headingsText: parseHeadingsText(draft.headings),
      summary: draft.summary,
      cta: draft.cta,
      fullDraft: stripLeadingMarkdownH1(draft.fullDraft),
      status: normalizeFreeArticleStatus(draft.status),
      publishedAt: draft.publishedAt,
      publishedUrl: draft.publishedUrl,
      publishedPv: draft.publishedPv,
      referralCount: draft.referralCount,
      purchaseCount: draft.purchaseCount,
      improvementCount: draft.improvementCount,
      evaluation,
      improvementSuggestions: evaluation
        ? generateFreeArticleImprovementSuggestions({
            id: draft.id,
            title: draft.title,
            publishedPv: draft.publishedPv,
            referralCount: draft.referralCount,
            purchaseCount: draft.purchaseCount,
            improvementCount: draft.improvementCount,
            publishedAt: draft.publishedAt,
            updatedAt: draft.updatedAt,
            evaluation,
          })
        : [],
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      destinationArticle: draft.destinationArticle,
    } satisfies FreeArticleEditorDraft,
    articles,
  };
}
