-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "noteUrl" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "pv" INTEGER NOT NULL,
    "purchases" INTEGER NOT NULL,
    "baselinePv" INTEGER NOT NULL DEFAULT 0,
    "baselinePurchases" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Article" ("baselinePurchases", "baselinePv", "createdAt", "id", "note", "price", "purchases", "pv", "title", "updatedAt") SELECT "baselinePurchases", "baselinePv", "createdAt", "id", "note", "price", "purchases", "pv", "title", "updatedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
