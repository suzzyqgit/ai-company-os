"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type ProductionMigrationActionState = {
  formError?: string;
};

export async function migrateToProductionAction(
  _previousState: ProductionMigrationActionState,
  formData: FormData,
): Promise<ProductionMigrationActionState> {
  void _previousState;

  const isRelatedDeletionConfirmed =
    formData.get("confirmRelatedDeletion") === "on";

  const result = await prisma.$transaction(async (tx) => {
    const targets = await tx.article.findMany({
      select: {
        id: true,
        _count: {
          select: {
            dailyMetrics: true,
            aiAnalysisRuns: true,
          },
        },
      },
    });

    const hasRelatedData = targets.some(
      (target) =>
        target._count.dailyMetrics > 0 || target._count.aiAnalysisRuns > 0,
    );

    if (hasRelatedData && !isRelatedDeletionConfirmed) {
      return {
        ok: false as const,
        deletedCount: 0,
        formError:
          "日次実績またはAI分析に紐付く記事があります。確認チェックを入れてから実行してください。",
      };
    }

    if (targets.length === 0) {
      return {
        ok: true as const,
        deletedCount: 0,
      };
    }

    const deleted = await tx.article.deleteMany({
      where: {
        id: {
          in: targets.map((target) => target.id),
        },
      },
    });

    return {
      ok: true as const,
      deletedCount: deleted.count,
    };
  });

  if (!result.ok) {
    return {
      formError: result.formError,
    };
  }

  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath("/analytics");
  revalidatePath("/production-migration");

  redirect(`/production-migration?deleted=${result.deletedCount}`);
}
