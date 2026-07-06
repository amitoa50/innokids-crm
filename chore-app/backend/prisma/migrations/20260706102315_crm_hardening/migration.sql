-- AlterTable
ALTER TABLE "Group" ADD COLUMN "endTime" TEXT;
ALTER TABLE "Group" ADD COLUMN "startDate" DATETIME;
ALTER TABLE "Group" ADD COLUMN "startTime" TEXT;
ALTER TABLE "Group" ADD COLUMN "timezone" TEXT DEFAULT 'Asia/Jerusalem';

-- AlterTable
ALTER TABLE "TrialLesson" ADD COLUMN "durationMinutes" INTEGER DEFAULT 45;
ALTER TABLE "TrialLesson" ADD COLUMN "locationType" TEXT;
ALTER TABLE "TrialLesson" ADD COLUMN "meetingUrl" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER,
    "studentId" INTEGER,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOGGED',
    "templateName" TEXT,
    "sentById" INTEGER,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalRef" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "system" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "email" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "campaignName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedToId" INTEGER,
    "nextFollowUpDate" DATETIME,
    "lastContactDate" DATETIME,
    "learningFormat" TEXT,
    "branch" TEXT,
    "closedReason" TEXT,
    "notes" TEXT,
    "childName" TEXT,
    "childBirthYear" INTEGER,
    "whatsappConsent" BOOLEAN NOT NULL DEFAULT false,
    "whatsappConsentAt" DATETIME,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "preferredChannel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("assignedToId", "branch", "campaignName", "closedReason", "createdAt", "email", "fullName", "id", "lastContactDate", "learningFormat", "nextFollowUpDate", "notes", "phone", "phoneNormalized", "source", "status", "updatedAt") SELECT "assignedToId", "branch", "campaignName", "closedReason", "createdAt", "email", "fullName", "id", "lastContactDate", "learningFormat", "nextFollowUpDate", "notes", "phone", "phoneNormalized", "source", "status", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_phoneNormalized_key" ON "Lead"("phoneNormalized");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Conversation_leadId_idx" ON "Conversation"("leadId");

-- CreateIndex
CREATE INDEX "Conversation_studentId_idx" ON "Conversation"("studentId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "ExternalRef_entityType_entityId_idx" ON "ExternalRef"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRef_system_externalId_key" ON "ExternalRef"("system", "externalId");
