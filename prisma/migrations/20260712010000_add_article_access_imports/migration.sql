-- CreateTable
CREATE TABLE "ArticleAccessImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "sourceFileCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArticleAccessImportItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "articleId" TEXT,
    "sourceFileName" TEXT NOT NULL,
    "extractedTitle" TEXT NOT NULL,
    "extractedPv" INTEGER NOT NULL,
    "previousPv" INTEGER,
    "nextPv" INTEGER,
    "status" TEXT NOT NULL,
    "warning" TEXT,
    "rawText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArticleAccessImportItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ArticleAccessImportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArticleAccessImportItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ArticleAccessImportItem_runId_idx" ON "ArticleAccessImportItem"("runId");

-- CreateIndex
CREATE INDEX "ArticleAccessImportItem_articleId_idx" ON "ArticleAccessImportItem"("articleId");

-- CreateIndex
CREATE INDEX "ArticleAccessImportItem_createdAt_idx" ON "ArticleAccessImportItem"("createdAt");
