-- CreateTable
CREATE TABLE "NoteSaleTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteSaleTransaction_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteSaleTransaction_transactionId_key" ON "NoteSaleTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "NoteSaleTransaction_articleId_date_idx" ON "NoteSaleTransaction"("articleId", "date");

-- CreateIndex
CREATE INDEX "NoteSaleTransaction_date_idx" ON "NoteSaleTransaction"("date");
