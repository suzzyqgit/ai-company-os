"use server";

import { prisma } from "@/lib/prisma";
import {
  getTodayTokyoDate,
  isTodayTaskKey,
  type TodayTaskKey,
} from "@/features/today/calculators";
import { revalidateToday } from "@/features/revalidation/paths";

type TodayTaskCompletionResult =
  | {
      ok: true;
      taskKey: TodayTaskKey;
      completed: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export async function updateTodayTaskCompletionAction(
  formData: FormData,
): Promise<TodayTaskCompletionResult> {
  const taskKey = formData.get("taskKey");
  const completed = formData.get("completed");

  if (
    typeof taskKey !== "string" ||
    taskKey.trim() === "" ||
    !isTodayTaskKey(taskKey)
  ) {
    return {
      ok: false,
      error: "タスクを保存できませんでした。画面を再読み込みして再度お試しください。",
    };
  }

  if (completed !== "true" && completed !== "false") {
    return {
      ok: false,
      error: "チェック状態を保存できませんでした。もう一度お試しください。",
    };
  }

  const isCompleted = completed === "true";
  const today = getTodayTokyoDate();

  try {
    await prisma.todayTaskCompletion.upsert({
      where: {
        date_taskKey: {
          date: today,
          taskKey,
        },
      },
      create: {
        date: today,
        taskKey,
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      update: {
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });
  } catch {
    return {
      ok: false,
      error: "チェック状態を保存できませんでした。もう一度お試しください。",
    };
  }

  revalidateToday();

  return {
    ok: true,
    taskKey,
    completed: isCompleted,
  };
}
