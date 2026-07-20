PRAGMA foreign_keys=OFF;

CREATE TABLE "new_FreeArticleDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "targetReader" TEXT NOT NULL,
    "readerProblem" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "destinationArticleId" TEXT,
    "destinationNoteUrl" TEXT NOT NULL,
    "titleIdeas" TEXT NOT NULL,
    "outline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "headings" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "fullDraft" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "freeArticleIdeaId" TEXT,
    "publishedAt" DATETIME,
    "publishedUrl" TEXT NOT NULL DEFAULT '',
    "publishedPv" INTEGER NOT NULL DEFAULT 0,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "improvementCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FreeArticleDraft_destinationArticleId_fkey" FOREIGN KEY ("destinationArticleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FreeArticleDraft_freeArticleIdeaId_fkey" FOREIGN KEY ("freeArticleIdeaId") REFERENCES "FreeArticleIdea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_FreeArticleDraft" (
    "id",
    "title",
    "theme",
    "targetReader",
    "readerProblem",
    "purpose",
    "destinationArticleId",
    "destinationNoteUrl",
    "titleIdeas",
    "outline",
    "body",
    "introduction",
    "headings",
    "summary",
    "cta",
    "fullDraft",
    "status",
    "createdAt",
    "updatedAt",
    "freeArticleIdeaId",
    "publishedAt",
    "publishedUrl",
    "publishedPv",
    "referralCount",
    "purchaseCount",
    "improvementCount"
)
SELECT
    "id",
    "title",
    "theme",
    "targetReader",
    "readerProblem",
    "purpose",
    "destinationArticleId",
    "destinationNoteUrl",
    "titleIdeas",
    "outline",
    "body",
    "introduction",
    "headings",
    "summary",
    "cta",
    "fullDraft",
    "status",
    "createdAt",
    "updatedAt",
    "freeArticleIdeaId",
    "publishedAt",
    "publishedUrl",
    "publishedPv",
    "referralCount",
    "purchaseCount",
    "improvementCount"
FROM "FreeArticleDraft";

DROP TABLE "FreeArticleDraft";
ALTER TABLE "new_FreeArticleDraft" RENAME TO "FreeArticleDraft";

CREATE UNIQUE INDEX "FreeArticleDraft_freeArticleIdeaId_key" ON "FreeArticleDraft"("freeArticleIdeaId");
CREATE INDEX "FreeArticleDraft_destinationArticleId_idx" ON "FreeArticleDraft"("destinationArticleId");
CREATE INDEX "FreeArticleDraft_theme_idx" ON "FreeArticleDraft"("theme");
CREATE INDEX "FreeArticleDraft_status_idx" ON "FreeArticleDraft"("status");
CREATE INDEX "FreeArticleDraft_createdAt_idx" ON "FreeArticleDraft"("createdAt");
CREATE INDEX "FreeArticleDraft_publishedAt_idx" ON "FreeArticleDraft"("publishedAt");

PRAGMA foreign_keys=ON;
