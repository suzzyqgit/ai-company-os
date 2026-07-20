export type NoteAccessExtractedItem = {
  sourceFileName: string;
  extractedTitle: string;
  normalizedTitle: string;
  extractedPv: number;
  originalOcrLine: string;
  rawText: string;
  matchedArticleId: string | null;
  matchedArticleTitle: string | null;
  matchMethod: string | null;
  matchSimilarity: number;
  matchConfidence: number;
  currentPv: number | null;
  warning: string | null;
};

export type NoteAccessPreview = {
  items: NoteAccessExtractedItem[];
  articles: Array<{
    id: string;
    title: string;
    pv: number;
  }>;
  fileCount: number;
  payload: string;
};

export type NoteAccessImportPayload = {
  fileCount: number;
  items: Array<{
    sourceFileName: string;
    extractedTitle: string;
    normalizedTitle: string;
    extractedPv: number;
    originalOcrLine: string;
    rawText: string;
  }>;
};

export type NoteAccessImportResult = {
  runId: string;
  updatedArticles: number;
  warningItems: number;
  skippedItems: number;
  savedItems: number;
  affectedArticleIds: string[];
};
