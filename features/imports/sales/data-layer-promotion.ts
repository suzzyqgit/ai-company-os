import { createHash } from "node:crypto";
import {
  ImportApprovalStatus,
  PromotionRunStatus,
  type PrismaClient,
} from "@prisma/client";

export type ProductResolution = {
  canonicalSalesRecordId: string;
  productId: string;
  confirmedByOwner: true;
};

export type PromotionAuthorization = {
  ownerApprovedBy: string;
  ownerApprovedAt: Date;
  approvedFingerprint: string;
};

export type PromotionPlan = {
  importRunId: string;
  inputFingerprint: string;
  recordCount: number;
  grossAmount: number;
  netAmount: number;
  resolutions: ProductResolution[];
};

function assertNonEmpty(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} is required`);
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function buildDataLayerPromotionPlan({
  prisma,
  importRunId,
  resolutions,
}: {
  prisma: PrismaClient;
  importRunId: string;
  resolutions: ProductResolution[];
}): Promise<PromotionPlan> {
  const importRun = await prisma.importRun.findUnique({
    where: { id: importRunId },
    include: {
      sources: { select: { id: true, approvalStatus: true } },
      canonicalSalesRecords: {
        where: { approvalStatus: ImportApprovalStatus.APPROVED },
        orderBy: [{ businessKey: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!importRun) throw new Error("ImportRun not found");
  if (
    importRun.status !== "COMPLETED" ||
    importRun.approvalStatus !== ImportApprovalStatus.APPROVED
  ) {
    throw new Error("ImportRun must be completed and approved");
  }

  const approvedSourceIds = new Set(
    importRun.sources
      .filter(({ approvalStatus }) => approvalStatus === ImportApprovalStatus.APPROVED)
      .map(({ id }) => id),
  );
  const eligibleRecords = importRun.canonicalSalesRecords.filter((record) =>
    approvedSourceIds.has(record.importSourceId),
  );
  if (eligibleRecords.length !== importRun.canonicalSalesRecords.length) {
    throw new Error("Every promoted ImportSource must be approved");
  }
  if (eligibleRecords.length === 0) {
    throw new Error("No approved Canonical Sales Records to promote");
  }

  const resolutionByRecord = new Map(
    resolutions.map((resolution) => [
      resolution.canonicalSalesRecordId,
      resolution,
    ]),
  );
  if (resolutionByRecord.size !== resolutions.length) {
    throw new Error("Duplicate product resolution");
  }
  if (resolutions.length !== eligibleRecords.length) {
    throw new Error("Owner-confirmed Product resolution is required for every record");
  }

  const productIds = new Set<string>();
  for (const record of eligibleRecords) {
    const resolution = resolutionByRecord.get(record.id);
    if (!resolution?.confirmedByOwner) {
      throw new Error(`Product resolution is not Owner-confirmed: ${record.id}`);
    }
    assertNonEmpty(resolution.productId, "productId");
    productIds.add(resolution.productId);
    if (record.quantity <= 0 || record.grossAmount % record.quantity !== 0) {
      throw new Error(`Sale amount cannot produce an integer unit price: ${record.id}`);
    }
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...productIds] }, status: "active" },
    select: { id: true },
  });
  if (products.length !== productIds.size) {
    throw new Error("Every resolved Product must exist and be active");
  }

  const canonicalInput = eligibleRecords.map((record) => ({
    id: record.id,
    importSourceId: record.importSourceId,
    businessKey: record.businessKey,
    sourceHash: record.sourceHash,
    grossAmount: record.grossAmount,
    netAmount: record.netAmount,
    productId: resolutionByRecord.get(record.id)!.productId,
  }));

  return {
    importRunId,
    inputFingerprint: fingerprint(canonicalInput),
    recordCount: eligibleRecords.length,
    grossAmount: eligibleRecords.reduce((sum, record) => sum + record.grossAmount, 0),
    netAmount: eligibleRecords.reduce((sum, record) => sum + (record.netAmount ?? 0), 0),
    resolutions: eligibleRecords.map((record) => resolutionByRecord.get(record.id)!),
  };
}

export async function executeDataLayerPromotion({
  prisma,
  plan,
  authorization,
  executedBy,
  now = new Date(),
  failAfterPromotions,
}: {
  prisma: PrismaClient;
  plan: PromotionPlan;
  authorization: PromotionAuthorization;
  executedBy: string;
  now?: Date;
  failAfterPromotions?: number;
}) {
  assertNonEmpty(executedBy, "executedBy");
  assertNonEmpty(authorization.ownerApprovedBy, "ownerApprovedBy");
  if (authorization.ownerApprovedAt > now) {
    throw new Error("Owner approval time cannot be in the future");
  }

  const currentPlan = await buildDataLayerPromotionPlan({
    prisma,
    importRunId: plan.importRunId,
    resolutions: plan.resolutions,
  });
  if (
    plan.inputFingerprint !== currentPlan.inputFingerprint ||
    authorization.approvedFingerprint !== currentPlan.inputFingerprint
  ) {
    throw new Error("Owner approval does not match the current promotion fingerprint");
  }

  const startedAt = now;
  try {
    return await prisma.$transaction(async (transaction) => {
      const records = await transaction.canonicalSalesRecord.findMany({
        where: {
          importRunId: plan.importRunId,
          approvalStatus: ImportApprovalStatus.APPROVED,
          importSource: { approvalStatus: ImportApprovalStatus.APPROVED },
        },
        orderBy: [{ businessKey: "asc" }, { id: "asc" }],
      });
      const resolutionByRecord = new Map(
        currentPlan.resolutions.map((resolution) => [
          resolution.canonicalSalesRecordId,
          resolution.productId,
        ]),
      );

      let promotedCount = 0;
      let skippedCount = 0;
      for (const record of records) {
        const existing = await transaction.sale.findFirst({
          where: {
            OR: [
              { businessKey: record.businessKey },
              { importLedgerId: record.id },
            ],
          },
        });
        if (existing) {
          if (
            existing.businessKey !== record.businessKey ||
            existing.importLedgerId !== record.id
          ) {
            throw new Error(`Promotion idempotency conflict: ${record.id}`);
          }
          skippedCount += 1;
          continue;
        }

        const productId = resolutionByRecord.get(record.id);
        if (!productId) throw new Error(`Missing Product resolution: ${record.id}`);
        await transaction.sale.create({
          data: {
            saleDate: record.saleDate,
            grossAmount: record.grossAmount,
            netAmount: record.netAmount,
            currency: record.currency,
            platform: record.platform,
            businessKey: record.businessKey,
            importLedgerId: record.id,
            items: {
              create: {
                productId,
                quantity: record.quantity,
                unitPrice: record.grossAmount / record.quantity,
              },
            },
          },
        });
        promotedCount += 1;
        if (
          failAfterPromotions !== undefined &&
          promotedCount >= failAfterPromotions
        ) {
          throw new Error("Injected promotion failure");
        }
      }

      const [saleTotals, saleItemCount] = await Promise.all([
        transaction.sale.aggregate({
          where: { importLedger: { importRunId: plan.importRunId } },
          _count: { id: true },
          _sum: { grossAmount: true, netAmount: true },
        }),
        transaction.saleItem.count({
          where: { sale: { importLedger: { importRunId: plan.importRunId } } },
        }),
      ]);
      if (
        saleTotals._count.id !== currentPlan.recordCount ||
        saleItemCount !== currentPlan.recordCount ||
        saleTotals._sum.grossAmount !== currentPlan.grossAmount ||
        (saleTotals._sum.netAmount ?? 0) !== currentPlan.netAmount
      ) {
        throw new Error("Post-promotion count or amount verification failed");
      }

      return transaction.promotionRun.create({
        data: {
          startedAt,
          completedAt: now,
          status: PromotionRunStatus.COMPLETED,
          importRunId: plan.importRunId,
          inputFingerprint: currentPlan.inputFingerprint,
          promotedCount,
          skippedCount,
          errorCount: 0,
          rollbackExecuted: false,
          executedBy,
          ownerApprovedBy: authorization.ownerApprovedBy,
          ownerApprovedAt: authorization.ownerApprovedAt,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown promotion error";
    await prisma.promotionRun.create({
      data: {
        startedAt,
        completedAt: now,
        status: PromotionRunStatus.FAILED,
        importRunId: plan.importRunId,
        inputFingerprint: currentPlan.inputFingerprint,
        promotedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        rollbackExecuted: true,
        executedBy,
        ownerApprovedBy: authorization.ownerApprovedBy,
        ownerApprovedAt: authorization.ownerApprovedAt,
        errorMessage: message,
      },
    });
    throw error;
  }
}
