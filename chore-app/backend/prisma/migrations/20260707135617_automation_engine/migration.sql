-- AlterTable
ALTER TABLE "ScheduledMessage" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "ScheduledMessage" ADD COLUMN "entityId" INTEGER;
ALTER TABLE "ScheduledMessage" ADD COLUMN "entityType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMessage_dedupeKey_key" ON "ScheduledMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "ScheduledMessage_entityType_entityId_idx" ON "ScheduledMessage"("entityType", "entityId");

