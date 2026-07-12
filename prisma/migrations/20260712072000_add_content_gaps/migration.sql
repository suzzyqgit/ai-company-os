-- CreateTable
CREATE TABLE "ContentGap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "expectedImpact" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentGap_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentGap_articleId_category_key" ON "ContentGap"("articleId", "category");

-- CreateIndex
CREATE INDEX "ContentGap_articleId_idx" ON "ContentGap"("articleId");

-- CreateIndex
CREATE INDEX "ContentGap_category_idx" ON "ContentGap"("category");

-- CreateIndex
CREATE INDEX "ContentGap_status_idx" ON "ContentGap"("status");

-- CreateIndex
CREATE INDEX "ContentGap_priority_idx" ON "ContentGap"("priority");

-- CreateIndex
CREATE INDEX "ContentGap_expectedImpact_idx" ON "ContentGap"("expectedImpact");
