-- AlterTable
ALTER TABLE "FreeArticleDraft" ADD COLUMN "freeArticleIdeaId" TEXT;

-- CreateTable
CREATE TABLE "FreeArticleIdea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "destinationArticleId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "searchIntent" TEXT NOT NULL,
    "targetReader" TEXT NOT NULL,
    "readerProblem" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "funnelRole" TEXT NOT NULL,
    "expectedCta" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "duplicateScore" INTEGER NOT NULL DEFAULT 0,
    "titleSimilarityScore" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FreeArticleIdea_destinationArticleId_fkey" FOREIGN KEY ("destinationArticleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FreeArticleDraft_freeArticleIdeaId_key" ON "FreeArticleDraft"("freeArticleIdeaId");

-- CreateIndex
CREATE INDEX "FreeArticleIdea_destinationArticleId_idx" ON "FreeArticleIdea"("destinationArticleId");

-- CreateIndex
CREATE INDEX "FreeArticleIdea_searchIntent_idx" ON "FreeArticleIdea"("searchIntent");

-- CreateIndex
CREATE INDEX "FreeArticleIdea_funnelRole_idx" ON "FreeArticleIdea"("funnelRole");

-- CreateIndex
CREATE INDEX "FreeArticleIdea_priority_idx" ON "FreeArticleIdea"("priority");

-- CreateIndex
CREATE INDEX "FreeArticleIdea_status_idx" ON "FreeArticleIdea"("status");

-- CreateIndex
CREATE INDEX "FreeArticleIdea_createdAt_idx" ON "FreeArticleIdea"("createdAt");
