import type { AgentMessageType, PrismaClient } from "@prisma/client";
import {
  createAgentMessage,
  createConversation,
  getActiveAgentByKey,
  getConversationByKey,
  getExtensionRegistryEntry,
} from "./repository.ts";
import {
  coreMessageSchemaVersion,
  validateCoreAgentMessage,
  type CoreAgentMessageInput,
} from "./schema.ts";

export type StartConversationInput = {
  conversationKey: string;
  title: string;
  topic?: string | null;
  createdByAgentKey: string;
};

export type SendAgentMessageInput = CoreAgentMessageInput & {
  conversationKey: string;
  senderAgentKey: string;
  attachments?: Array<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksum?: string | null;
    storageRef: string;
    description?: string | null;
  }>;
};

function assertNonEmpty(value: string, field: string) {
  if (value.trim() === "") {
    throw new Error(`${field} is required`);
  }
}

export async function startConversation({
  prisma,
  input,
}: {
  prisma: PrismaClient;
  input: StartConversationInput;
}) {
  assertNonEmpty(input.conversationKey, "conversationKey");
  assertNonEmpty(input.title, "title");
  assertNonEmpty(input.createdByAgentKey, "createdByAgentKey");

  const agent = await getActiveAgentByKey({
    prisma,
    key: input.createdByAgentKey,
  });
  if (!agent) {
    throw new Error("Active agent not found");
  }

  const existing = await getConversationByKey({
    prisma,
    key: input.conversationKey,
  });
  if (existing) {
    return existing;
  }

  return createConversation({
    prisma,
    key: input.conversationKey,
    title: input.title,
    topic: input.topic,
    createdByAgentId: agent.id,
  });
}

export async function sendAgentMessage({
  prisma,
  input,
}: {
  prisma: PrismaClient;
  input: SendAgentMessageInput;
}) {
  const validation = validateCoreAgentMessage(input);
  if (!validation.ok) {
    throw new Error(`Invalid agent message: ${validation.issues.join(",")}`);
  }

  const [conversation, senderAgent] = await Promise.all([
    getConversationByKey({ prisma, key: input.conversationKey }),
    getActiveAgentByKey({ prisma, key: input.senderAgentKey }),
  ]);

  if (!conversation) {
    throw new Error("Conversation not found");
  }
  if (!senderAgent) {
    throw new Error("Active sender agent not found");
  }

  if (input.extensionType && input.extensionVersion) {
    const extension = await getExtensionRegistryEntry({
      prisma,
      extensionType: input.extensionType,
      extensionVersion: input.extensionVersion,
    });
    if (!extension || extension.status !== "ACTIVE") {
      throw new Error("Active extension registry entry not found");
    }
  }

  return createAgentMessage({
    prisma,
    conversationId: conversation.id,
    senderAgentId: senderAgent.id,
    messageType: input.messageType as AgentMessageType,
    content: input.content,
    summary: input.summary,
    schemaVersion: coreMessageSchemaVersion,
    extensionType: input.extensionType,
    extensionVersion: input.extensionVersion,
    extensionPayload:
      input.extensionPayload === undefined || input.extensionPayload === null
        ? null
        : JSON.stringify(input.extensionPayload),
    attachments: input.attachments,
  });
}
