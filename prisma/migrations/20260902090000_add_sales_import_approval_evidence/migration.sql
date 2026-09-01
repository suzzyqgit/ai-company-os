ALTER TABLE "ImportRun" ADD COLUMN "approvalFingerprint" TEXT;
ALTER TABLE "ImportRun" ADD COLUMN "approvalFingerprintVersion" TEXT;
ALTER TABLE "ImportRun" ADD COLUMN "approvalDecisionRef" TEXT;
ALTER TABLE "ImportRun" ADD COLUMN "approvalAuthorityRole" TEXT;
ALTER TABLE "ImportRun" ADD COLUMN "approvalAuthorityEvidenceDigest" TEXT;
ALTER TABLE "ImportRun" ADD COLUMN "approvalVerifierId" TEXT;

ALTER TABLE "ImportSource" ADD COLUMN "approvalFingerprint" TEXT;
ALTER TABLE "ImportSource" ADD COLUMN "approvalFingerprintVersion" TEXT;
ALTER TABLE "ImportSource" ADD COLUMN "approvalDecisionRef" TEXT;
ALTER TABLE "ImportSource" ADD COLUMN "approvalAuthorityRole" TEXT;
ALTER TABLE "ImportSource" ADD COLUMN "approvalAuthorityEvidenceDigest" TEXT;
ALTER TABLE "ImportSource" ADD COLUMN "approvalVerifierId" TEXT;

ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "approvalFingerprint" TEXT;
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "approvalFingerprintVersion" TEXT;
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "approvalDecisionRef" TEXT;
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "approvalAuthorityRole" TEXT;
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "approvalAuthorityEvidenceDigest" TEXT;
ALTER TABLE "CanonicalSalesRecord" ADD COLUMN "approvalVerifierId" TEXT;
