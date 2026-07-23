-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "importedAt" DATETIME NOT NULL,
    "importedBy" TEXT NOT NULL,
    "pipelineVersion" TEXT NOT NULL,
    "summaryJson" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importRunId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "confidence" REAL,
    "metadataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportSource_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importRunId" TEXT NOT NULL,
    "importSourceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "observedAt" DATETIME,
    "confidence" REAL,
    "status" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "articleId" TEXT,
    "pv" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Snapshot_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Snapshot_importSourceId_fkey" FOREIGN KEY ("importSourceId") REFERENCES "ImportSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Snapshot_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportRun_status_idx" ON "ImportRun"("status");

-- CreateIndex
CREATE INDEX "ImportRun_importedAt_idx" ON "ImportRun"("importedAt");

-- CreateIndex
CREATE INDEX "ImportRun_importedBy_idx" ON "ImportRun"("importedBy");

-- CreateIndex
CREATE INDEX "ImportSource_importRunId_idx" ON "ImportSource"("importRunId");

-- CreateIndex
CREATE INDEX "ImportSource_sourceHash_idx" ON "ImportSource"("sourceHash");

-- CreateIndex
CREATE INDEX "ImportSource_sourceType_idx" ON "ImportSource"("sourceType");

-- CreateIndex
CREATE INDEX "Snapshot_importRunId_idx" ON "Snapshot"("importRunId");

-- CreateIndex
CREATE INDEX "Snapshot_importSourceId_idx" ON "Snapshot"("importSourceId");

-- CreateIndex
CREATE INDEX "Snapshot_domain_snapshotType_status_observedAt_idx" ON "Snapshot"("domain", "snapshotType", "status", "observedAt");

-- CreateIndex
CREATE INDEX "Snapshot_domain_status_createdAt_idx" ON "Snapshot"("domain", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Snapshot_articleId_idx" ON "Snapshot"("articleId");
