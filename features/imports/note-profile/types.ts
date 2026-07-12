export type NoteProfileArticle = {
  title: string;
  noteUrl: string;
  price: number;
  key: string;
};

export type ArticleMatchMethod =
  | "exact"
  | "normalized"
  | "partial"
  | "similarity"
  | "none";

export type NoteProfileMatchedArticle = {
  publicArticle: NoteProfileArticle;
  articleId: string;
  articleTitle: string;
  currentNoteUrl: string;
  matchMethod: Exclude<ArticleMatchMethod, "none">;
  confidence: number;
  shouldUpdateNoteUrl: boolean;
};

export type NoteProfileMissingArticle = {
  publicArticle: NoteProfileArticle;
  matchMethod: "none";
  confidence: 0;
};

export type NoteProfilePreview = {
  profileUrl: string;
  urlname: string;
  totalPublicArticles: number;
  matchedArticles: NoteProfileMatchedArticle[];
  missingArticles: NoteProfileMissingArticle[];
  payload: string;
};

export type NoteProfileImportPayload = {
  profileUrl: string;
  urlname: string;
  publicArticles: NoteProfileArticle[];
};

export type NoteProfileImportResult = {
  updatedArticles: number;
  createdArticles: number;
  skippedArticles: number;
};
