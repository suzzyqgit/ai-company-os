-- AlterTable
ALTER TABLE "FreeArticleDraft" ADD COLUMN "publishedAt" DATETIME;
ALTER TABLE "FreeArticleDraft" ADD COLUMN "publishedUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FreeArticleDraft" ADD COLUMN "publishedPv" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FreeArticleDraft" ADD COLUMN "referralCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FreeArticleDraft" ADD COLUMN "purchaseCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FreeArticleDraft" ADD COLUMN "improvementCount" INTEGER NOT NULL DEFAULT 0;

-- Normalize existing draft statuses into the pipeline vocabulary.
UPDATE "FreeArticleDraft"
SET "status" = CASE
  WHEN lower("status") = 'idea' THEN 'IDEA'
  WHEN lower("status") = 'drafting' THEN 'DRAFT'
  WHEN lower("status") = 'draft' THEN 'DRAFT'
  WHEN lower("status") = 'review' THEN 'REVIEW'
  WHEN lower("status") = 'ready' THEN 'READY'
  WHEN lower("status") = 'published' THEN 'PUBLISHED'
  WHEN lower("status") = 'improving' THEN 'IMPROVING'
  WHEN lower("status") = 'archived' THEN 'ARCHIVED'
  ELSE "status"
END;

-- CreateIndex
CREATE INDEX "FreeArticleDraft_publishedAt_idx" ON "FreeArticleDraft"("publishedAt");
