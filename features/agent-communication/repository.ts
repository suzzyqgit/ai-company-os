import type {
  AgentMessageType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export function getAgentByKey({
  prisma,
  key,
}: {
  prisma: PrismaClient | PrismaTransaction;
  key: string;
}) {
  return prisma.agentRegistry.findUnique({
    where: { key },
  });
}

export function getActiveAgentByKey({
  prisma,
  key,
}: {
  prisma: PrismaClient | PrismaTransaction;
  key: string;
}) {
  return prisma.agentRegistry.findFirst({
    where: {
      key,
      status: "ACTIVE",
    },
  });
}

export function getExtensionRegistryEntry({
  prisma,
  extensionType,
  extensionVersion,
}: {
  prisma: PrismaClient | PrismaTransaction;
  extensionType: string;
  extensionVersion: string;
}) {
  return prisma.extensionRegistry.findUnique({
    where: {
      extensionType_extensionVersion: {
        extensionType,
        extensionVersion,
      },
    },
  });
}

export function getConversationByKey({
  prisma,
  key,
}: {
  prisma: PrismaClient | PrismaTransaction;
  key: string;
}) {
  return prisma.conversation.findUnique({
    where: { key },
    include: {
      createdByAgent: true,
      messages: {
        include: {
          senderAgent: true,
          attachments: true,
        },
        orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      },
    },
  });
}

export function createConversation({
  prisma,
  key,
  title,
  topic,
  createdByAgentId,
}: {
  prisma: PrismaClient | PrismaTransaction;
  key: string;
  title: string;
  topic?: string | null;
  createdByAgentId: string;
}) {
  return prisma.conversation.create({
    data: {
      key,
      title,
      topic,
      createdByAgentId,
    },
  });
}

export function createAgentMessage({
  prisma,
  conversationId,
  senderAgentId,
  messageType,
  content,
  summary,
  schemaVersion,
  extensionType,
  extensionVersion,
  extensionPayload,
  attachments = [],
}: {
  prisma: PrismaClient | PrismaTransaction;
  conversationId: string;
  senderAgentId: string;
  messageType: AgentMessageType;
  content: string;
  summary?: string | null;
  schemaVersion: string;
  extensionType?: string | null;
  extensionVersion?: string | null;
  extensionPayload?: string | null;
  attachments?: Array<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksum?: string | null;
    storageRef: string;
    description?: string | null;
  }>;
}) {
  return prisma.agentMessage.create({
    data: {
      conversationId,
      senderAgentId,
      messageType,
      content,
      summary,
      schemaVersion,
      extensionType,
      extensionVersion,
      extensionPayload,
      attachments: attachments.length
        ? {
            create: attachments,
          }
        : undefined,
    },
    include: {
      attachments: true,
      senderAgent: true,
    },
  });
}

export function listMessagesForConversation({
  prisma,
  conversationId,
}: {
  prisma: PrismaClient | PrismaTransaction;
  conversationId: string;
}) {
  return prisma.agentMessage.findMany({
    where: { conversationId },
    include: {
      senderAgent: true,
      attachments: true,
    },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
  });
}

export function createManyExtensionRegistryEntries({
  prisma,
  entries,
}: {
  prisma: PrismaClient | PrismaTransaction;
  entries: Prisma.ExtensionRegistryCreateManyInput[];
}) {
  return prisma.extensionRegistry.createMany({
    data: entries,
  });
}
