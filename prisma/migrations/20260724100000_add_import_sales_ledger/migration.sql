-- CreateTable
CREATE TABLE "CanonicalSalesRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importRunId" TEXT NOT NULL,
    "importSourceId" TEXT NOT NULL,
    "businessKey" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "saleDate" DATETIME NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "netAmount" INTEGER,
    "currency" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "validationJson" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL,
    "importedBy" TEXT NOT NULL,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "reviewReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CanonicalSalesRecord_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CanonicalSalesRecord_importSourceId_fkey" FOREIGN KEY ("importSourceId") REFERENCES "ImportSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CanonicalSalesRecord_importSourceId_businessKey_sourceHash_key"
ON "CanonicalSalesRecord"("importSourceId", "businessKey", "sourceHash");

CREATE INDEX "CanonicalSalesRecord_importRunId_idx" ON "CanonicalSalesRecord"("importRunId");
CREATE INDEX "CanonicalSalesRecord_importSourceId_idx" ON "CanonicalSalesRecord"("importSourceId");
CREATE INDEX "CanonicalSalesRecord_approvalStatus_idx" ON "CanonicalSalesRecord"("approvalStatus");
CREATE INDEX "CanonicalSalesRecord_businessKey_idx" ON "CanonicalSalesRecord"("businessKey");
CREATE INDEX "CanonicalSalesRecord_sourceHash_idx" ON "CanonicalSalesRecord"("sourceHash");
