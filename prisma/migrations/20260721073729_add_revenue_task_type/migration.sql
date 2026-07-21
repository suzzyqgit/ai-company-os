-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RevenueTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL,
    "articleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "RevenueTask_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RevenueTask" ("articleId", "completedAt", "createdAt", "id", "priority", "status", "title", "updatedAt") SELECT "articleId", "completedAt", "createdAt", "id", "priority", "status", "title", "updatedAt" FROM "RevenueTask";
DROP TABLE "RevenueTask";
ALTER TABLE "new_RevenueTask" RENAME TO "RevenueTask";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
