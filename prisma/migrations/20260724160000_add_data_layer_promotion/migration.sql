-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable
ALTER TABLE "Article" ADD COLUMN "productId" TEXT
  REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleDate" DATETIME NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "netAmount" INTEGER,
    "currency" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "businessKey" TEXT NOT NULL,
    "importLedgerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_importLedgerId_fkey" FOREIGN KEY ("importLedgerId") REFERENCES "CanonicalSalesRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromotionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "promotedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "rollbackExecuted" BOOLEAN NOT NULL DEFAULT false,
    "executedBy" TEXT NOT NULL,
    "ownerApprovedBy" TEXT NOT NULL,
    "ownerApprovedAt" DATETIME NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionRun_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Article_productId_idx" ON "Article"("productId");
CREATE INDEX "Product_name_idx" ON "Product"("name");
CREATE UNIQUE INDEX "Sale_businessKey_key" ON "Sale"("businessKey");
CREATE UNIQUE INDEX "Sale_importLedgerId_key" ON "Sale"("importLedgerId");
CREATE INDEX "Sale_saleDate_idx" ON "Sale"("saleDate");
CREATE INDEX "Sale_platform_idx" ON "Sale"("platform");
CREATE UNIQUE INDEX "SaleItem_saleId_productId_key" ON "SaleItem"("saleId", "productId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
CREATE INDEX "PromotionRun_importRunId_idx" ON "PromotionRun"("importRunId");
CREATE INDEX "PromotionRun_status_idx" ON "PromotionRun"("status");
CREATE INDEX "PromotionRun_inputFingerprint_idx" ON "PromotionRun"("inputFingerprint");
