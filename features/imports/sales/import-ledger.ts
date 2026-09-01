import { createHash } from "node:crypto";
import {
  ImportApprovalStatus,
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
        originalProductName: record.sale.productName,
        normalizedProductName: record.sale.productName.normalize("NFKC").trim(),
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

export async function transitionSalesImportApproval(request: {
  prisma: PrismaClient;
  recordId: string;
  to: ImportApprovalStatus;
  reviewedBy: string;
  reason?: string;
  reviewedAt?: Date;
}): Promise<never> {
  void request;
  throw new Error(
    "Direct Sales Import approval transition is disabled; use the bounded approval lifecycle",
  );
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
