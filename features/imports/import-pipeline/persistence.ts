import type { PrismaClient } from "@prisma/client";
import {
  type ImportOutput,
  type ImportOutputSnapshot,
  validateImportOutput,
} from "./output-schema.ts";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type PersistImportOutputResult = {
  importRunId: string;
  importSourceId: string;
  snapshotIds: string[];
  duplicateApprovedSnapshotCount: number;
  status: "completed" | "failed" | "review_required";
};

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function getRunStatus(output: ImportOutput, duplicateApprovedSnapshotCount: number) {
  if (output.importRun.status === "failed" || output.validation.ok === false) {
    return "failed" as const;
  }

  if (
    output.importRun.status === "review_required" ||
    output.snapshots.some((snapshot) => snapshot.status !== "approved") ||
    duplicateApprovedSnapshotCount > 0
  ) {
    return "review_required" as const;
  }

  return "completed" as const;
}

export async function persistImportOutput({
  prisma,
  output,
}: {
  prisma: PrismaClient;
  output: ImportOutput;
}): Promise<PersistImportOutputResult> {
  const validation = validateImportOutput(output);

  if (!validation.ok) {
    throw new Error(`Invalid import output: ${validation.issues.join(", ")}`);
  }

  return prisma.$transaction(async (transaction) => {
    return persistImportOutputInTransaction({
      transaction,
      output,
    });
  });
}

export async function persistImportOutputInTransaction({
  transaction,
  output,
}: {
  transaction: PrismaTransaction;
  output: ImportOutput;
}): Promise<PersistImportOutputResult> {
  const duplicateApprovedSnapshotCount =
    output.snapshots.length === 0
      ? 0
      : await transaction.snapshot.count({
          where: {
            importSource: {
              sourceHash: output.importSource.sourceHash,
            },
            status: "approved",
          },
        });
  const status = getRunStatus(output, duplicateApprovedSnapshotCount);
  const run = await transaction.importRun.create({
    data: {
      status,
      startedAt: new Date(output.importRun.startedAt),
      completedAt: toDate(output.importRun.completedAt),
      importedAt: new Date(output.importRun.importedAt),
      importedBy: output.importRun.importedBy,
      pipelineVersion: output.importRun.pipelineVersion,
      summaryJson: output.importRun.summary
        ? JSON.stringify(output.importRun.summary)
        : null,
      error: output.importRun.error,
    },
    select: {
      id: true,
    },
  });
  const source = await transaction.importSource.create({
    data: {
      importRunId: run.id,
      sourceType: output.importSource.sourceType,
      sourceFile: output.importSource.sourceFile,
      sourceHash: output.importSource.sourceHash,
      parserVersion: output.importSource.parserVersion,
      confidence: output.importSource.confidence,
      metadataJson: JSON.stringify(output.importSource),
    },
    select: {
      id: true,
    },
  });
  const snapshotIds: string[] = [];

  for (const snapshot of output.snapshots) {
    const safeSnapshot = duplicateApprovedSnapshotCount > 0 && snapshot.status === "approved"
      ? {
          ...snapshot,
          status: "review_required" as const,
        } satisfies ImportOutputSnapshot
      : snapshot;
    const created = await transaction.snapshot.create({
      data: {
        importRunId: run.id,
        importSourceId: source.id,
        domain: safeSnapshot.domain,
        snapshotType: safeSnapshot.snapshotType,
        periodStart: toDate(safeSnapshot.periodStart),
        periodEnd: toDate(safeSnapshot.periodEnd),
        observedAt: toDate(safeSnapshot.observedAt),
        confidence: safeSnapshot.confidence,
        status: safeSnapshot.status,
        validationStatus: safeSnapshot.validationStatus,
        dataJson: JSON.stringify(safeSnapshot.data),
        evidenceJson: JSON.stringify(safeSnapshot.evidence),
        articleId: safeSnapshot.articleId ?? null,
        pv: safeSnapshot.pv ?? null,
        likes: safeSnapshot.likes ?? null,
        comments: safeSnapshot.comments ?? null,
      },
      select: {
        id: true,
      },
    });

    snapshotIds.push(created.id);
  }

  return {
    importRunId: run.id,
    importSourceId: source.id,
    snapshotIds,
    duplicateApprovedSnapshotCount,
    status,
  };
}
