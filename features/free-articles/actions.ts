"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidateFreeArticlePipeline } from "@/features/revalidation/paths";
import {
  canTransitionFreeArticleStatus,
  isFreeArticlePipelineStatus,
  isValidPublishedNoteUrl,
  type FreeArticlePipelineStatus,
} from "./status";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateFreeArticleDetail(id: string) {
  revalidateFreeArticlePipeline([id]);
}

async function ensureDraftExists(id: string) {
  if (!id) {
    return null;
  }

  return prisma.freeArticleDraft.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
      publishedAt: true,
    },
  });
}

function toHeadingsJson(value: string) {
  return JSON.stringify(
    value
      .split(/\r?\n/)
      .map((heading) => heading.trim())
      .filter(Boolean),
  );
}

export async function updateFreeArticleDraftAction(
  id: string,
  formData: FormData,
): Promise<void> {
  const draft = await prisma.freeArticleDraft.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      freeArticleIdeaId: true,
      status: true,
      publishedAt: true,
    },
  });

  if (!draft) {
    return;
  }

  const destinationArticleId = getString(formData, "destinationArticleId");
  const destinationArticle = destinationArticleId
    ? await prisma.article.findUnique({
        where: {
          id: destinationArticleId,
        },
        select: {
          id: true,
          noteUrl: true,
        },
      })
    : null;

  if (destinationArticleId && (!destinationArticle || !destinationArticle.noteUrl.trim())) {
    return;
  }

  const searchIntent = getString(formData, "searchIntent");
  const publishedUrl = getString(formData, "publishedUrl");

  if (publishedUrl && !isValidPublishedNoteUrl(publishedUrl)) {
    redirect(`/free-articles/${id}?error=invalidPublishedUrl`);
  }

  const isSavingImprovement = draft.status === "IMPROVING";

  await prisma.$transaction([
    prisma.freeArticleDraft.update({
      where: {
        id,
      },
      data: {
        title: getString(formData, "title"),
        theme: getString(formData, "theme"),
        targetReader: getString(formData, "targetReader"),
        readerProblem: getString(formData, "readerProblem"),
        purpose: getString(formData, "purpose"),
        destinationArticleId: destinationArticle?.id ?? null,
        destinationNoteUrl: destinationArticle?.noteUrl ?? "",
        introduction: getString(formData, "introduction"),
        headings: toHeadingsJson(getString(formData, "headingsText")),
        body: getString(formData, "body"),
        summary: getString(formData, "summary"),
        cta: getString(formData, "cta"),
        fullDraft: getString(formData, "fullDraft"),
        publishedUrl,
        ...(isSavingImprovement
          ? {
              status: "PUBLISHED" satisfies FreeArticlePipelineStatus,
              publishedAt: draft.publishedAt ?? new Date(),
              improvementCount: {
                increment: 1,
              },
            }
          : {}),
      },
    }),
    ...(draft.freeArticleIdeaId
      ? [
          prisma.freeArticleIdea.update({
            where: {
              id: draft.freeArticleIdeaId,
            },
            data: {
              searchIntent,
            },
          }),
        ]
      : []),
  ]);

  revalidateFreeArticleDetail(id);
}

export async function markFreeArticlePublishedAction(
  formData: FormData,
): Promise<void> {
  const id = getString(formData, "id");
  const publishedUrl = getString(formData, "publishedUrl");
  const draft = await ensureDraftExists(id);

  if (!draft) {
    return;
  }

  if (!publishedUrl) {
    redirect(`/free-articles/${id}?error=publishedUrlRequired`);
  }

  if (!isValidPublishedNoteUrl(publishedUrl)) {
    redirect(`/free-articles/${id}?error=invalidPublishedUrl`);
  }

  if (!canTransitionFreeArticleStatus({ from: draft.status, to: "PUBLISHED" })) {
    return;
  }

  await prisma.freeArticleDraft.update({
    where: {
      id,
    },
    data: {
      status: "PUBLISHED" satisfies FreeArticlePipelineStatus,
      publishedAt: draft.publishedAt ?? new Date(),
      publishedUrl,
    },
  });
  revalidateFreeArticleDetail(id);
}

export async function updateFreeArticleStatusAction(
  formData: FormData,
): Promise<void> {
  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!isFreeArticlePipelineStatus(status)) {
    return;
  }

  const draft = await ensureDraftExists(id);

  if (!draft) {
    return;
  }

  if (!canTransitionFreeArticleStatus({ from: draft.status, to: status })) {
    return;
  }

  await prisma.freeArticleDraft.update({
    where: {
      id,
    },
    data: {
      status,
    },
  });
  revalidateFreeArticleDetail(id);
}

export async function sendFreeArticleToImprovementAction(
  formData: FormData,
): Promise<void> {
  const id = getString(formData, "id");
  const draft = await ensureDraftExists(id);

  if (!draft) {
    return;
  }

  if (!canTransitionFreeArticleStatus({ from: draft.status, to: "IMPROVING" })) {
    return;
  }

  if (draft.status === "IMPROVING") {
    revalidateFreeArticleDetail(id);
    return;
  }

  await prisma.freeArticleDraft.update({
    where: {
      id,
    },
    data: {
      status: "IMPROVING" satisfies FreeArticlePipelineStatus,
    },
  });
  revalidateFreeArticleDetail(id);
}

export async function archiveFreeArticleAction(
  formData: FormData,
): Promise<void> {
  const id = getString(formData, "id");
  const draft = await ensureDraftExists(id);

  if (!draft) {
    return;
  }

  if (!canTransitionFreeArticleStatus({ from: draft.status, to: "ARCHIVED" })) {
    return;
  }

  await prisma.freeArticleDraft.update({
    where: {
      id,
    },
    data: {
      status: "ARCHIVED" satisfies FreeArticlePipelineStatus,
    },
  });
  revalidateFreeArticleDetail(id);
}
