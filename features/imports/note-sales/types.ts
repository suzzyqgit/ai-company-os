export const noteSalesExpectedHeaders = [
  "決済/返金日時",
  "購入者名",
  "決済種別",
  "決済方法",
  "コンテンツ種別",
  "コンテンツ名",
  "販売額",
  "消費税率",
  "税抜販売額",
  "消費税額",
  "ポイント利用",
  "取引ID",
  "発行事業者",
  "適格事業者登録番号",
] as const;

export const noteSaleTypes = ["販売", "返金"] as const;

export type NoteSaleType = (typeof noteSaleTypes)[number];

export type ParsedNoteSaleRow = {
  fileName: string;
  rowNumber: number;
  transactionId: string;
  occurredAt: string;
  dateInput: string;
  type: NoteSaleType;
  contentType: string;
  title: string;
  amount: number;
};

export type NoteSalesRowIssue = {
  fileName: string;
  rowNumber: number;
  reason: string;
  severity: "error" | "skip" | "warning";
};

export type NoteSalesArticlePreview = {
  title: string;
  contentType: string;
  status: "new" | "existing";
  articleId: string | null;
  salesCount: number;
  refundCount: number;
  netPurchases: number;
  grossSales: number;
  grossRefunds: number;
  netRevenue: number;
  latestSaleAmount: number;
  shouldUpdatePrice: boolean;
};

export type NoteSalesPreviewSummary = {
  fileCount: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  skippedRows: number;
  duplicateCandidates: number;
  newArticleCount: number;
  existingArticleCount: number;
  salesCount: number;
  refundCount: number;
  grossSales: number;
  grossRefunds: number;
  netRevenue: number;
};

export type NoteSalesImportPreview = {
  summary: NoteSalesPreviewSummary;
  articles: NoteSalesArticlePreview[];
  issues: NoteSalesRowIssue[];
  payload: string;
};

export type NoteSalesImportPayload = {
  rows: ParsedNoteSaleRow[];
};

export type NoteSalesImportResult = {
  createdArticles: number;
  updatedArticles: number;
  newTransactions: number;
  duplicateSkipped: number;
  errorRows: number;
  updatedDailyMetrics: number;
  netPurchases: number;
  netRevenue: number;
};
