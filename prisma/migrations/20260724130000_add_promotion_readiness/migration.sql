ALTER TABLE "ImportRun" ADD COLUMN "importMode" TEXT NOT NULL DEFAULT 'DRY_RUN';
ALTER TABLE "ImportRun" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ImportRun" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "ImportRun" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "ImportRun" ADD COLUMN "reviewReason" TEXT;

ALTER TABLE "ImportSource" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ImportSource" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "ImportSource" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "ImportSource" ADD COLUMN "reviewReason" TEXT;

ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "originalProductName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "normalizedProductName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "candidateArticleId" TEXT;
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "candidateProductId" TEXT;
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "matchConfidence" REAL;
