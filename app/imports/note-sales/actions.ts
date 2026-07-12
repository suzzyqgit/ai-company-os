"use server";

import { revalidatePath } from "next/cache";
import {
  summarizeRows,
  summarizeRowsByArticle,
} from "@/features/imports/note-sales/calculator";
import { parseNoteSalesCsv } from "@/features/imports/note-sales/parser";
import {
  getExistingArticlesByTitle,
  getExistingTransactionIds,
  importNoteSaleTransactions,
} from "@/features/imports/note-sales/queries";
import type {
  NoteSalesImportPayload,
  NoteSalesImportPreview,
  NoteSalesImportResult,
  NoteSalesRowIssue,
  ParsedNoteSaleRow,
} from "@/features/imports/note-sales/types";

export type NoteSalesImportActionState = {
  formError?: string;
  preview?: NoteSalesImportPreview;
  result?: NoteSalesImportResult;
};

const maxFileSizeBytes = 5 * 1024 * 1024;
const maxTotalFileSizeBytes = 20 * 1024 * 1024;

function isFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && "arrayBuffer" in value && "name" in value;
}

function isCsvFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.type === ""
  );
}

function encodePayload(payload: NoteSalesImportPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodePayload(value: string): NoteSalesImportPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as {
      rows?: unknown;
    };

    if (!Array.isArray(parsed.rows)) {
      return null;
    }

    const rows = parsed.rows.filter((row): row is ParsedNoteSaleRow => {
      if (typeof row !== "object" || row === null) {
        return false;
      }

      const candidate = row as Partial<ParsedNoteSaleRow>;
      return (
        typeof candidate.fileName === "string" &&
        typeof candidate.rowNumber === "number" &&
        typeof candidate.transactionId === "string" &&
        typeof candidate.occurredAt === "string" &&
        typeof candidate.dateInput === "string" &&
        (candidate.type === "販売" || candidate.type === "返金") &&
        typeof candidate.contentType === "string" &&
        typeof candidate.title === "string" &&
        typeof candidate.amount === "number" &&
        Number.isInteger(candidate.amount) &&
        candidate.amount >= 0
      );
    });

    if (rows.length !== parsed.rows.length) {
      return null;
    }

    return { rows };
  } catch {
    return null;
  }
}

function getPayloadDuplicateIds(rows: ParsedNoteSaleRow[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  rows.forEach((row) => {
    if (seen.has(row.transactionId)) {
      duplicates.add(row.transactionId);
      return;
    }

    seen.add(row.transactionId);
  });

  return duplicates;
}

function getImportCandidateRows({
  rows,
  existingTransactionIds,
}: {
  rows: ParsedNoteSaleRow[];
  existingTransactionIds: Set<string>;
}) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    if (existingTransactionIds.has(row.transactionId)) {
      return false;
    }

    if (seen.has(row.transactionId)) {
      return false;
    }

    seen.add(row.transactionId);
    return true;
  });
}

export async function previewNoteSalesImportAction(
  _previousState: NoteSalesImportActionState,
  formData: FormData,
): Promise<NoteSalesImportActionState> {
  void _previousState;

  const files = formData.getAll("files").filter(isFile);

  if (files.length === 0) {
    return {
      formError: "CSVファイルを選択してください。",
    };
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);
  const fileError = files.find((file) => !isCsvFile(file));

  if (fileError) {
    return {
      formError: `CSV以外のファイルは取り込めません: ${fileError.name}`,
    };
  }

  const oversizedFile = files.find((file) => file.size > maxFileSizeBytes);

  if (oversizedFile) {
    return {
      formError: `ファイルサイズ上限は1ファイル5MBです: ${oversizedFile.name}`,
    };
  }

  if (totalSize > maxTotalFileSizeBytes) {
    return {
      formError: "合計ファイルサイズ上限は20MBです。",
    };
  }

  const issues: NoteSalesRowIssue[] = [];
  const parsedRows: ParsedNoteSaleRow[] = [];
  let totalRows = 0;

  for (const file of files) {
    const text = Buffer.from(await file.arrayBuffer()).toString("utf8");
    const parsed = parseNoteSalesCsv({
      fileName: file.name,
      text,
    });

    totalRows += parsed.totalRows;
    parsedRows.push(...parsed.parsedRows);
    issues.push(...parsed.issues);
  }

  const titles = Array.from(new Set(parsedRows.map((row) => row.title)));
  const transactionIds = Array.from(
    new Set(parsedRows.map((row) => row.transactionId)),
  );
  const [existingArticleByTitle, existingTransactionIds] = await Promise.all([
    getExistingArticlesByTitle(titles),
    getExistingTransactionIds(transactionIds),
  ]);
  const duplicateInPayloadIds = getPayloadDuplicateIds(parsedRows);

  duplicateInPayloadIds.forEach((transactionId) => {
    const row = parsedRows.find((candidate) => candidate.transactionId === transactionId);

    if (row) {
      issues.push({
        fileName: row.fileName,
        rowNumber: row.rowNumber,
        severity: "skip",
        reason: `取引ID「${transactionId}」がアップロード内で重複しています。初回分のみ取り込み候補にします。`,
      });
    }
  });

  existingTransactionIds.forEach((transactionId) => {
    const row = parsedRows.find((candidate) => candidate.transactionId === transactionId);

    if (row) {
      issues.push({
        fileName: row.fileName,
        rowNumber: row.rowNumber,
        severity: "skip",
        reason: `取引ID「${transactionId}」は既に取り込み済みです。`,
      });
    }
  });

  const importCandidateRows = getImportCandidateRows({
    rows: parsedRows,
    existingTransactionIds,
  });
  const duplicateTransactionIds = new Set(
    parsedRows
      .filter((row) => !importCandidateRows.includes(row))
      .map((row) => row.transactionId),
  );

  const netByArticleDate = new Map<
    string,
    { row: ParsedNoteSaleRow; purchases: number; revenue: number }
  >();

  importCandidateRows.forEach((row) => {
    const key = `${row.title}:${row.dateInput}`;
    const current = netByArticleDate.get(key) ?? {
      row,
      purchases: 0,
      revenue: 0,
    };

    current.purchases += row.type === "返金" ? -1 : 1;
    current.revenue += row.type === "返金" ? -row.amount : row.amount;
    netByArticleDate.set(key, current);
  });

  netByArticleDate.forEach((summary) => {
    if (summary.purchases < 0 || summary.revenue < 0) {
      issues.push({
        fileName: summary.row.fileName,
        rowNumber: summary.row.rowNumber,
        severity: "warning",
        reason:
          "同じ記事・同じ日の純購入数または純売上が負数になります。返金行が販売行より多い可能性があります。",
      });
    }
  });
  const rowSummary = summarizeRows(importCandidateRows);
  const articles = summarizeRowsByArticle({
    rows: parsedRows,
    existingArticleByTitle,
    duplicateTransactionIds,
  });
  const errorRows = issues.filter((issue) => issue.severity === "error").length;
  const skippedRows = issues.filter((issue) => issue.severity === "skip").length;
  const newArticleCount = articles.filter((article) => article.status === "new").length;
  const existingArticleCount = articles.filter(
    (article) => article.status === "existing",
  ).length;

  return {
    preview: {
      summary: {
        fileCount: files.length,
        totalRows,
        validRows: parsedRows.length,
        errorRows,
        skippedRows,
        duplicateCandidates: duplicateTransactionIds.size,
        newArticleCount,
        existingArticleCount,
        salesCount: rowSummary.salesCount,
        refundCount: rowSummary.refundCount,
        grossSales: rowSummary.grossSales,
        grossRefunds: rowSummary.grossRefunds,
        netRevenue: rowSummary.netRevenue,
      },
      articles,
      issues,
      payload: encodePayload({
        rows: parsedRows,
      }),
    },
  };
}

export async function executeNoteSalesImportAction(
  _previousState: NoteSalesImportActionState,
  formData: FormData,
): Promise<NoteSalesImportActionState> {
  void _previousState;

  const payload = decodePayload(
    typeof formData.get("payload") === "string"
      ? String(formData.get("payload"))
      : "",
  );
  const shouldUpdatePrices = formData.get("shouldUpdatePrices") === "on";

  if (!payload) {
    return {
      formError: "プレビュー情報が壊れています。CSVを再度解析してください。",
    };
  }

  if (payload.rows.length === 0) {
    return {
      formError: "取り込み可能な行がありません。",
    };
  }

  try {
    const result = await importNoteSaleTransactions({
      rows: payload.rows,
      shouldUpdatePrices,
    });

    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath("/analytics");
    revalidatePath("/metrics/daily");
    result.affectedArticleIds.forEach((articleId) => {
      revalidatePath(`/articles/${articleId}`);
    });

    return {
      result,
    };
  } catch {
    return {
      formError: "インポートに失敗しました。CSV内容を確認してください。",
    };
  }
}
