"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { RevenueTaskStatus, RevenueTaskType } from "@prisma/client";

const revenueTaskStatuses = ["TODO", "DOING", "DONE"] as const;
const revenueTaskTypes = ["GENERAL", "CTA_IMPROVEMENT"] as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parsePriority(value: string) {
  const priority = Number(value);

  if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
    return null;
  }

  return priority;
}

function isRevenueTaskStatus(value: string): value is RevenueTaskStatus {
  return revenueTaskStatuses.includes(value as RevenueTaskStatus);
}

function isRevenueTaskType(value: string): value is RevenueTaskType {
  return revenueTaskTypes.includes(value as RevenueTaskType);
}

function revalidateRevenue() {
  revalidatePath("/revenue");
}

export async function createRevenueTaskAction(formData: FormData) {
  const title = getString(formData, "title");
  const type = getString(formData, "type");
  const priority = parsePriority(getString(formData, "priority"));
  const articleId = getString(formData, "articleId");

  if (title === "" || !isRevenueTaskType(type) || priority === null) {
    revalidateRevenue();
    return;
  }

  const article =
    articleId === ""
      ? null
      : await prisma.article.findUnique({
          where: { id: articleId },
          select: { id: true },
        });

  if (articleId !== "" && article === null) {
    revalidateRevenue();
    return;
  }

  await prisma.revenueTask.create({
    data: {
      title,
      type,
      priority,
      articleId: article?.id ?? null,
    },
  });

  revalidateRevenue();
}

export async function updateRevenueTaskStatusAction(formData: FormData) {
  const taskId = getString(formData, "taskId");
  const status = getString(formData, "status");

  if (taskId === "" || !isRevenueTaskStatus(status)) {
    revalidateRevenue();
    return;
  }

  await prisma.revenueTask.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  revalidateRevenue();
}
