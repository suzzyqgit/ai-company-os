import type { RunnableConfig } from "@langchain/core/runnables";
import type { PrismaClient } from "@prisma/client";
import type {
  EvidenceFixture,
  EvidenceStatus,
  WorkflowInput,
} from "./contracts.ts";
import { createWorkflowRuntime } from "./runtime.ts";

export interface OdlEvidenceRequest {
  reference: string;
  callerClaimedStatus?: EvidenceStatus;
}

function hasStructuredEvidence(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as unknown;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Resolves a workflow EvidenceFixture from the canonical Snapshot record.
 *
 * The caller's claimed status is deliberately ignored. The adapter maps the
 * existing ODL record to the existing Evidence Gate contract and performs no
 * write operation.
 */
export class ReadOnlySnapshotOdlEvidenceAdapter {
  readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async resolve(request: OdlEvidenceRequest): Promise<EvidenceFixture> {
    const reference = request.reference.trim();
    const checkedAt = new Date().toISOString();

    if (reference === "") {
      return {
        reference: "",
        status: "MISSING",
        source: "OPERATIONAL_DATA_LAYER_ADAPTER_FIXTURE",
        checkedAt,
      };
    }

    const snapshot = await this.prisma.snapshot.findUnique({
      where: {
        id: reference,
      },
      select: {
        status: true,
        validationStatus: true,
        evidenceJson: true,
        importRun: {
          select: {
            status: true,
          },
        },
      },
    });

    const confirmed =
      snapshot?.status === "approved" &&
      snapshot.validationStatus === "passed" &&
      snapshot.importRun.status === "completed" &&
      hasStructuredEvidence(snapshot.evidenceJson);

    return {
      reference,
      status: snapshot === null ? "MISSING" : confirmed ? "CONFIRMED" : "UNVERIFIED",
      source: "OPERATIONAL_DATA_LAYER_ADAPTER_FIXTURE",
      checkedAt,
    };
  }
}

export async function createReadOnlyOdlEvidenceWorkflowRuntime(
  databaseUrl: string,
) {
  const runtime = await createWorkflowRuntime(databaseUrl);
  const evidenceAdapter = new ReadOnlySnapshotOdlEvidenceAdapter(runtime.prisma);

  return {
    ...runtime,
    evidenceAdapter,
    async start(input: WorkflowInput, config: RunnableConfig) {
      const evidence = await evidenceAdapter.resolve({
        reference: input.evidence.reference,
        callerClaimedStatus: input.evidence.status,
      });

      return runtime.graph.invoke(
        {
          ...input,
          evidence,
        },
        config,
      );
    },
  };
}
