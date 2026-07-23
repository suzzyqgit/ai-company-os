import { createHash } from "node:crypto";
import {
  ImportApprovalStatus,
  type CanonicalSalesRecord,
  type PrismaClient,
} from "@prisma/client";
import {
  canonicalSalesSchemaVersion,
  validateCanonicalSale,
  type CanonicalSale,
} from "./canonical-sales.ts";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export const importApprovalStatuses = [
  ImportApprovalStatus.PENDING,
  ImportApprovalStatus.REVIEW_REQUIRED,
  ImportApprovalStatus.APPROVED,
  ImportApprovalStatus.REJECTED,
] as const;

export type ImportLedgerRecordInput = {
  businessKey?: string;
  sale: CanonicalSale;
  approvalStatus?: ImportApprovalStatus;
};

export type PersistSalesImportLedgerResult = {
  createdIds: string[];
  existingIds: string[];
};

export function buildSalesBusinessKey(sale: CanonicalSale) {
  const values = [
    sale.saleDate,
    sale.productName.normalize("NFKC").trim(),
    sale.quantity,
    sale.grossAmount,
    sale.netAmount,
    sale.currency,
    sale.platform,
  ];

  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

function assertSourceHash(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("Invalid ImportSource sourceHash");
  }
}

function getInitialApproval(
  requested: ImportApprovalStatus | undefined,
  validationOk: boolean,
) {
  if (
    requested === ImportApprovalStatus.APPROVED ||
    requested === ImportApprovalStatus.REJECTED
  ) {
    throw new Error("Import Ledger records must start in a reviewable state");
  }

  if (!validationOk) return ImportApprovalStatus.REVIEW_REQUIRED;
  return requested ?? ImportApprovalStatus.PENDING;
}

export async function persistSalesImportLedger({
  prisma,
  importRunId,
  importSourceId,
  records,
}: {
  prisma: PrismaClient;
  importRunId: string;
  importSourceId: string;
  records: ImportLedgerRecordInput[];
}): Promise<PersistSalesImportLedgerResult> {
  return prisma.$transaction((transaction) =>
    persistSalesImportLedgerInTransaction({
      transaction,
      importRunId,
      importSourceId,
      records,
    }),
  );
}

export async function persistSalesImportLedgerInTransaction({
  transaction,
  importRunId,
  importSourceId,
  records,
}: {
  transaction: PrismaTransaction;
  importRunId: string;
  importSourceId: string;
  records: ImportLedgerRecordInput[];
}): Promise<PersistSalesImportLedgerResult> {
  const source = await transaction.importSource.findUnique({
    where: { id: importSourceId },
    include: { importRun: true },
  });

  if (!source || source.importRunId !== importRunId) {
    throw new Error("ImportRun and ImportSource traceability mismatch");
  }
  assertSourceHash(source.sourceHash);

  const createdIds: string[] = [];
  const existingIds: string[] = [];

  for (const record of records) {
    const validation = validateCanonicalSale(record.sale);
    const approvalStatus = getInitialApproval(
      record.approvalStatus,
      validation.ok,
    );
    const businessKey = record.businessKey ?? buildSalesBusinessKey(record.sale);

    if (!/^[a-f0-9]{64}$/.test(businessKey)) {
      throw new Error("Invalid Canonical Sales businessKey");
    }

    const idempotencyKey = {
      importSourceId_businessKey_sourceHash: {
        importSourceId,
        businessKey,
        sourceHash: source.sourceHash,
      },
    };
    const existing = await transaction.canonicalSalesRecord.findUnique({
      where: idempotencyKey,
      select: { id: true },
    });

    if (existing) {
      existingIds.push(existing.id);
      continue;
    }

    const created = await transaction.canonicalSalesRecord.create({
      data: {
        importRunId,
        importSourceId,
        businessKey,
        sourceHash: source.sourceHash,
        schemaVersion: canonicalSalesSchemaVersion,
        parserVersion: source.parserVersion,
        saleDate: new Date(record.sale.saleDate),
        productName: record.sale.productName,
        quantity: record.sale.quantity,
        grossAmount: record.sale.grossAmount,
        netAmount: record.sale.netAmount,
        currency: record.sale.currency,
        platform: record.sale.platform,
        source: record.sale.source,
        confidence: record.sale.confidence,
        approvalStatus,
        validationJson: JSON.stringify(validation),
        importedAt: source.importRun.importedAt,
        importedBy: source.importRun.importedBy,
      },
      select: { id: true },
    });
    createdIds.push(created.id);
  }

  return { createdIds, existingIds };
}

const allowedTransitions: Record<ImportApprovalStatus, ImportApprovalStatus[]> = {
  PENDING: [
    ImportApprovalStatus.REVIEW_REQUIRED,
    ImportApprovalStatus.APPROVED,
    ImportApprovalStatus.REJECTED,
  ],
  REVIEW_REQUIRED: [
    ImportApprovalStatus.APPROVED,
    ImportApprovalStatus.REJECTED,
  ],
  APPROVED: [],
  REJECTED: [],
};

export async function transitionSalesImportApproval({
  prisma,
  recordId,
  to,
  reviewedBy,
  reason,
  reviewedAt = new Date(),
}: {
  prisma: PrismaClient;
  recordId: string;
  to: ImportApprovalStatus;
  reviewedBy: string;
  reason?: string;
  reviewedAt?: Date;
}): Promise<CanonicalSalesRecord> {
  if (!reviewedBy.trim()) throw new Error("reviewedBy is required");

  return prisma.$transaction(async (transaction) => {
    const record = await transaction.canonicalSalesRecord.findUnique({
      where: { id: recordId },
    });
    if (!record) throw new Error("Canonical Sales Record not found");
    if (!allowedTransitions[record.approvalStatus].includes(to)) {
      throw new Error(
        `Invalid approval transition: ${record.approvalStatus} -> ${to}`,
      );
    }

    const validation = JSON.parse(record.validationJson) as { ok?: boolean };
    if (to === ImportApprovalStatus.APPROVED && validation.ok !== true) {
      throw new Error("Invalid Canonical Sale cannot be APPROVED");
    }
    if (
      (to === ImportApprovalStatus.REJECTED ||
        to === ImportApprovalStatus.REVIEW_REQUIRED) &&
      !reason?.trim()
    ) {
      throw new Error("A review reason is required");
    }

    return transaction.canonicalSalesRecord.update({
      where: { id: recordId },
      data: {
        approvalStatus: to,
        reviewedAt,
        reviewedBy,
        reviewReason: reason?.trim() || null,
      },
    });
  });
}

export function getApprovedSalesImportRecords({
  prisma,
  importRunId,
}: {
  prisma: PrismaClient;
  importRunId?: string;
}) {
  return prisma.canonicalSalesRecord.findMany({
    where: {
      approvalStatus: ImportApprovalStatus.APPROVED,
      ...(importRunId ? { importRunId } : {}),
    },
    orderBy: [{ saleDate: "asc" }, { id: "asc" }],
  });
}
