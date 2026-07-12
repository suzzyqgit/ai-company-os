-- CreateTable
CREATE TABLE "TodayTaskCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "taskKey" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TodayTaskCompletion_date_taskKey_key" ON "TodayTaskCompletion"("date", "taskKey");

-- CreateIndex
CREATE INDEX "TodayTaskCompletion_date_idx" ON "TodayTaskCompletion"("date");

-- CreateIndex
CREATE INDEX "TodayTaskCompletion_taskKey_idx" ON "TodayTaskCompletion"("taskKey");
