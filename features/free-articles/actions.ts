"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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

function revalidateFreeArticlePipeline() {
  revalidatePath("/free-articles");
  revalidatePath("/content-gap");
  revalidatePath("/ai-improvements");
  revalidatePath("/today");
  revalidatePath("/");
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
    },
  });
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
  revalidateFreeArticlePipeline();
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

  if (
    !isValidPublishedNoteUrl(publishedUrl) ||
    !canTransitionFreeArticleStatus({ from: draft.status, to: "PUBLISHED" })
  ) {
    return;
  }

  await prisma.freeArticleDraft.update({
    where: {
      id,
    },
    data: {
      status: "PUBLISHED" satisfies FreeArticlePipelineStatus,
      publishedAt: draft.status === "PUBLISHED" ? undefined : new Date(),
      publishedUrl,
    },
  });
  revalidateFreeArticlePipeline();
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

  await prisma.freeArticleDraft.update({
    where: {
      id,
    },
    data: {
      status: "IMPROVING" satisfies FreeArticlePipelineStatus,
      improvementCount: {
        increment: draft.status === "IMPROVING" ? 0 : 1,
      },
    },
  });
  revalidateFreeArticlePipeline();
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
  revalidateFreeArticlePipeline();
}
