import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { RunnableConfig } from "@langchain/core/runnables";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { PrismaClient } from "@prisma/client";
import {
  DeterministicAuthorityRouter,
  FixtureEvidenceGateAdapter,
  SqliteSideEffectLedger,
} from "./adapters.ts";
import { createWorkflowGraph } from "./workflow.ts";

export interface SqliteConnectionTarget {
  databasePath: string;
  databaseUrl: string;
}

export function resolveSqliteConnection(
  databaseUrl: string,
  relativeBaseDirectory = resolve(process.cwd(), "prisma"),
): SqliteConnectionTarget {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("workflow_poc_requires_sqlite_file_database");
  }

  const rawPath = databaseUrl.slice("file:".length).split("?", 1)[0];

  if (!rawPath || rawPath === ":memory:") {
    throw new Error("workflow_poc_requires_durable_sqlite_file");
  }

  const decodedPath = decodeURIComponent(rawPath);
  const databasePath = isAbsolute(decodedPath)
    ? decodedPath
    : resolve(relativeBaseDirectory, decodedPath);

  return {
    databasePath,
    databaseUrl: `file:${databasePath}`,
  };
}

export function workflowConfig(threadId: string): RunnableConfig {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}

export async function createWorkflowRuntime(databaseUrl: string) {
  const target = resolveSqliteConnection(databaseUrl);

  if (!existsSync(target.databasePath)) {
    throw new Error("workflow_poc_requires_existing_sqlite_database");
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: target.databaseUrl,
      },
    },
  });

  await prisma.$connect();
  try {
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");

    const requiredOperationalTables = new Set(["ImportRun", "Sale", "Snapshot"]);
    const existingTables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );

    for (const table of existingTables) {
      requiredOperationalTables.delete(table.name);
    }

    if (requiredOperationalTables.size > 0) {
      throw new Error("workflow_poc_requires_existing_odl_schema");
    }
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }

  const sideEffects = new SqliteSideEffectLedger(prisma);
  await sideEffects.initialize();

  const checkpointer = SqliteSaver.fromConnString(target.databasePath);
  const graph = createWorkflowGraph({
    evidenceGate: new FixtureEvidenceGateAdapter(),
    authorityRouter: new DeterministicAuthorityRouter(),
    sideEffects,
  }).compile({
    checkpointer,
    name: "kavora_workflow_continuation_poc",
  });

  let closed = false;

  return {
    graph,
    prisma,
    checkpointer,
    sideEffects,
    target,
    async close() {
      if (closed) return;
      closed = true;
      await prisma.$disconnect();
      checkpointer.db.close();
    },
  };
}
