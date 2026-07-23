import type { PrismaClient } from "@prisma/client";
import type { JsonRecord } from "./output-schema.ts";

export type SnapshotFeedStatus = "approved" | "review_required" | "rejected";

export type SnapshotFeedQuery = {
  domain?: string;
  snapshotType?: string;
  status?: SnapshotFeedStatus;
  cursor?: string;
  limit?: number;
};

export type SnapshotFeedItem = {
  id: string;
  domain: string;
  snapshotType: string;
  periodStart: string | null;
  periodEnd: string | null;
  observedAt: string | null;
  confidence: number | null;
  status: string;
  validationStatus: string;
  data: JsonRecord;
  evidence: JsonRecord;
  source: {
    id: string;
    sourceType: string;
    sourceFile: string;
    sourceHash: string;
    parserVersion: string;
  };
  importRun: {
    id: string;
    importedAt: string;
    importedBy: string;
    pipelineVersion: string;
  };
};

export type SnapshotFeedResult = {
  items: SnapshotFeedItem[];
  nextCursor: string | null;
};

function parseJsonRecord(value: string): JsonRecord {
  const parsed = JSON.parse(value) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  return parsed as JsonRecord;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

export async function getSnapshotFeed({
  prisma,
  query = {},
}: {
  prisma: PrismaClient;
  query?: SnapshotFeedQuery;
}): Promise<SnapshotFeedResult> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const rows = await prisma.snapshot.findMany({
    where: {
      domain: query.domain,
      snapshotType: query.snapshotType,
      status: query.status,
    },
    orderBy: [
      {
        observedAt: "desc",
      },
      {
        createdAt: "desc",
      },
      {
        id: "asc",
      },
    ],
    cursor: query.cursor
      ? {
          id: query.cursor,
        }
      : undefined,
    skip: query.cursor ? 1 : 0,
    take: limit + 1,
    include: {
      importSource: true,
      importRun: true,
    },
  });
  const page = rows.slice(0, limit);

  return {
    items: page.map((row) => ({
      id: row.id,
      domain: row.domain,
      snapshotType: row.snapshotType,
      periodStart: toIso(row.periodStart),
      periodEnd: toIso(row.periodEnd),
      observedAt: toIso(row.observedAt),
      confidence: row.confidence,
      status: row.status,
      validationStatus: row.validationStatus,
      data: parseJsonRecord(row.dataJson),
      evidence: parseJsonRecord(row.evidenceJson),
      source: {
        id: row.importSource.id,
        sourceType: row.importSource.sourceType,
        sourceFile: row.importSource.sourceFile,
        sourceHash: row.importSource.sourceHash,
        parserVersion: row.importSource.parserVersion,
      },
      importRun: {
        id: row.importRun.id,
        importedAt: row.importRun.importedAt.toISOString(),
        importedBy: row.importRun.importedBy,
        pipelineVersion: row.importRun.pipelineVersion,
      },
    })),
    nextCursor: rows.length > limit ? rows[limit].id : null,
  };
}
