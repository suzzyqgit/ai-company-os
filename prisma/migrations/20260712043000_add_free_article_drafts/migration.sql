-- CreateTable
CREATE TABLE "FreeArticleDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "targetReader" TEXT NOT NULL,
    "readerProblem" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "destinationArticleId" TEXT NOT NULL,
    "destinationNoteUrl" TEXT NOT NULL,
    "titleIdeas" TEXT NOT NULL,
    "outline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "headings" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "fullDraft" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FreeArticleDraft_destinationArticleId_fkey" FOREIGN KEY ("destinationArticleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FreeArticleDraft_destinationArticleId_idx" ON "FreeArticleDraft"("destinationArticleId");

-- CreateIndex
CREATE INDEX "FreeArticleDraft_theme_idx" ON "FreeArticleDraft"("theme");

-- CreateIndex
CREATE INDEX "FreeArticleDraft_status_idx" ON "FreeArticleDraft"("status");

-- CreateIndex
CREATE INDEX "FreeArticleDraft_createdAt_idx" ON "FreeArticleDraft"("createdAt");
