-- CreateTable
CREATE TABLE "ArticleDailyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "pv" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "masterTransitions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArticleDailyMetric_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "pv" INTEGER NOT NULL,
    "purchases" INTEGER NOT NULL,
    "baselinePv" INTEGER NOT NULL DEFAULT 0,
    "baselinePurchases" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Article" ("baselinePurchases", "baselinePv", "createdAt", "id", "note", "price", "purchases", "pv", "title", "updatedAt") SELECT "purchases", "pv", "createdAt", "id", "note", "price", "purchases", "pv", "title", "updatedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ArticleDailyMetric_date_idx" ON "ArticleDailyMetric"("date");

-- CreateIndex
CREATE INDEX "ArticleDailyMetric_articleId_date_idx" ON "ArticleDailyMetric"("articleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleDailyMetric_articleId_date_key" ON "ArticleDailyMetric"("articleId", "date");
