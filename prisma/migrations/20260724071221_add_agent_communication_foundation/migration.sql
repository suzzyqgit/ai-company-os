-- CreateTable
CREATE TABLE "AgentRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByAgentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_createdByAgentId_fkey" FOREIGN KEY ("createdByAgentId") REFERENCES "AgentRegistry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderAgentId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "schemaVersion" TEXT NOT NULL DEFAULT 'agent-message-core-v1',
    "extensionType" TEXT,
    "extensionVersion" TEXT,
    "extensionPayload" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentMessage_senderAgentId_fkey" FOREIGN KEY ("senderAgentId") REFERENCES "AgentRegistry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttachmentMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "storageRef" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttachmentMetadata_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AgentMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunicationPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "appliesToAgentKey" TEXT,
    "allowedMessageTypes" TEXT NOT NULL,
    "allowedExtensionTypes" TEXT NOT NULL,
    "retentionPolicy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExtensionRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extensionType" TEXT NOT NULL,
    "extensionVersion" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "jsonSchema" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistry_key_key" ON "AgentRegistry"("key");

-- CreateIndex
CREATE INDEX "AgentRegistry_status_idx" ON "AgentRegistry"("status");

-- CreateIndex
CREATE INDEX "AgentRegistry_role_idx" ON "AgentRegistry"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_key_key" ON "Conversation"("key");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE INDEX "Conversation_createdByAgentId_idx" ON "Conversation"("createdByAgentId");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_conversationId_idx" ON "AgentMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AgentMessage_senderAgentId_idx" ON "AgentMessage"("senderAgentId");

-- CreateIndex
CREATE INDEX "AgentMessage_messageType_idx" ON "AgentMessage"("messageType");

-- CreateIndex
CREATE INDEX "AgentMessage_extensionType_extensionVersion_idx" ON "AgentMessage"("extensionType", "extensionVersion");

-- CreateIndex
CREATE INDEX "AgentMessage_sentAt_idx" ON "AgentMessage"("sentAt");

-- CreateIndex
CREATE INDEX "AttachmentMetadata_messageId_idx" ON "AttachmentMetadata"("messageId");

-- CreateIndex
CREATE INDEX "AttachmentMetadata_checksum_idx" ON "AttachmentMetadata"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPolicy_key_key" ON "CommunicationPolicy"("key");

-- CreateIndex
CREATE INDEX "CommunicationPolicy_status_idx" ON "CommunicationPolicy"("status");

-- CreateIndex
CREATE INDEX "CommunicationPolicy_appliesToAgentKey_idx" ON "CommunicationPolicy"("appliesToAgentKey");

-- CreateIndex
CREATE INDEX "ExtensionRegistry_extensionType_idx" ON "ExtensionRegistry"("extensionType");

-- CreateIndex
CREATE INDEX "ExtensionRegistry_status_idx" ON "ExtensionRegistry"("status");

-- CreateIndex
CREATE INDEX "ExtensionRegistry_ownerRole_idx" ON "ExtensionRegistry"("ownerRole");

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionRegistry_extensionType_extensionVersion_key" ON "ExtensionRegistry"("extensionType", "extensionVersion");
