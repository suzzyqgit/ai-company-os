import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  AgentStatus,
  CommunicationPolicyStatus,
  ExtensionStatus,
  PrismaClient,
} from "@prisma/client";
import {
  agentRegistrySeed,
  communicationPolicySeed,
  extensionRegistrySeed,
} from "../prisma/agent-communication-seed-data.mjs";
import {
  agentMessageTypes,
  coreMessageSchemaVersion,
  getExtensionDefinition,
  sendAgentMessage,
  startConversation,
  validateCoreAgentMessage,
} from "../features/agent-communication/index.ts";

const execFileAsync = promisify(execFile);
let prisma: PrismaClient;
let cleanupDatabase: () => Promise<void>;

async function createPrismaClient() {
  const directory = await mkdtemp(
    join(process.env.TMPDIR ?? "/tmp", "agent-communication-"),
  );
  const databasePath = join(directory, "test.db");
  const databaseUrl = `file:${databasePath}`;
  const migrationDirectories = await readdir(
    join(process.cwd(), "prisma/migrations"),
    { withFileTypes: true },
  );

  for (const migrationDirectory of migrationDirectories
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    await execFileAsync(
      "sqlite3",
      [databasePath, `.read ${join(process.cwd(), "prisma/migrations", migrationDirectory, "migration.sql")}`],
      {
        cwd: process.cwd(),
      },
    );
  }

  return {
    prisma: new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    }),
    cleanup: async () => {
      await rm(directory, {
        recursive: true,
        force: true,
      });
    },
  };
}

async function seedAgentCommunicationFixture() {
  for (const agent of agentRegistrySeed) {
    const data = {
      ...agent,
      status: AgentStatus.ACTIVE,
    };
    await prisma.agentRegistry.upsert({
      where: { key: agent.key },
      update: data,
      create: data,
    });
  }

  for (const extension of extensionRegistrySeed) {
    const data = {
      ...extension,
      status: ExtensionStatus.ACTIVE,
    };
    await prisma.extensionRegistry.upsert({
      where: {
        extensionType_extensionVersion: {
          extensionType: extension.extensionType,
          extensionVersion: extension.extensionVersion,
        },
      },
      update: data,
      create: data,
    });
  }

  for (const policy of communicationPolicySeed) {
    const data = {
      ...policy,
      status: CommunicationPolicyStatus.ACTIVE,
    };
    await prisma.communicationPolicy.upsert({
      where: { key: policy.key },
      update: data,
      create: data,
    });
  }
}

test.before(async () => {
  const client = await createPrismaClient();
  prisma = client.prisma;
  cleanupDatabase = client.cleanup;
});

test.after(async () => {
  if (!prisma || !cleanupDatabase) return;
  await prisma.$disconnect();
  await cleanupDatabase();
});

test.beforeEach(async () => {
  if (!prisma) return;
  await prisma.attachmentMetadata.deleteMany();
  await prisma.agentMessage.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.communicationPolicy.deleteMany();
  await prisma.extensionRegistry.deleteMany();
  await prisma.agentRegistry.deleteMany();
  await seedAgentCommunicationFixture();
});

test("fixes the Core Message Schema to the approved eight message types", () => {
  assert.equal(coreMessageSchemaVersion, "agent-message-core-v1");
  assert.deepEqual(agentMessageTypes, [
    "STATUS_UPDATE",
    "REQUEST",
    "RESPONSE",
    "DECISION",
    "REVIEW",
    "APPROVAL",
    "CHANGE_REQUEST",
    "HANDOFF",
  ]);
});

test("seeds agent registry, communication policy, and approved extensions", async () => {
  assert.equal(await prisma.agentRegistry.count(), agentRegistrySeed.length);
  assert.equal(await prisma.extensionRegistry.count(), extensionRegistrySeed.length);
  assert.equal(await prisma.communicationPolicy.count(), communicationPolicySeed.length);

  assert.ok(getExtensionDefinition({
    extensionType: "cmo-reference",
    extensionVersion: "1.0",
  }));
  assert.ok(getExtensionDefinition({
    extensionType: "cpo-context",
    extensionVersion: "1.0",
  }));
  assert.ok(getExtensionDefinition({
    extensionType: "ceo-decision",
    extensionVersion: "1.0",
  }));
  assert.ok(getExtensionDefinition({
    extensionType: "architecture-review",
    extensionVersion: "1.0",
  }));
  assert.ok(getExtensionDefinition({
    extensionType: "engineering-note",
    extensionVersion: "1.0",
  }));
});

test("persists a conversation, message, extension payload, and attachment metadata", async () => {
  const conversation = await startConversation({
    prisma,
    input: {
      conversationKey: "case-002-cmo-review",
      title: "Case No.002 CMO Review",
      topic: "Revenue recovery marketing review",
      createdByAgentKey: "CMO",
    },
  });

  const message = await sendAgentMessage({
    prisma,
    input: {
      conversationKey: conversation.key,
      senderAgentKey: "CMO",
      messageType: "REVIEW",
      content: "CMO reviewed the revenue recovery context.",
      summary: "CMO reference attached.",
      extensionType: "cmo-reference",
      extensionVersion: "1.0",
      extensionPayload: {
        referenceType: "dataset",
        referenceId: "Case No.002",
        source: "data/note/current/business_snapshot.json",
        summary: "Shared note business snapshot.",
      },
      attachments: [
        {
          fileName: "business_snapshot.json",
          mimeType: "application/json",
          sizeBytes: 1024,
          checksum: "a".repeat(64),
          storageRef: "data/note/current/business_snapshot.json",
          description: "Approved current snapshot.",
        },
      ],
    },
  });

  assert.equal(message.schemaVersion, coreMessageSchemaVersion);
  assert.equal(message.extensionType, "cmo-reference");
  assert.equal(message.extensionVersion, "1.0");
  assert.equal(message.attachments.length, 1);
  assert.equal(message.attachments[0].storageRef, "data/note/current/business_snapshot.json");
});

test("rejects unsupported message types and incomplete extension payloads", () => {
  const unsupported = validateCoreAgentMessage({
    messageType: "TASK" as never,
    content: "Invalid type",
  });
  assert.equal(unsupported.ok, false);
  assert.ok(unsupported.issues.includes("message_type_unsupported"));

  const incomplete = validateCoreAgentMessage({
    messageType: "REQUEST",
    content: "Missing required CMO fields.",
    extensionType: "cmo-reference",
    extensionVersion: "1.0",
    extensionPayload: {
      referenceType: "dataset",
    },
  });
  assert.equal(incomplete.ok, false);
  assert.ok(
    incomplete.issues.includes("extension_required_field_missing:referenceId"),
  );
});

test("does not write Import Layer, Data Layer, or Company Memory records", async () => {
  const conversation = await startConversation({
    prisma,
    input: {
      conversationKey: "engineering-handoff",
      title: "Engineering Handoff",
      createdByAgentKey: "CODEX",
    },
  });
  await sendAgentMessage({
    prisma,
    input: {
      conversationKey: conversation.key,
      senderAgentKey: "CODEX",
      messageType: "HANDOFF",
      content: "Implementation handoff only.",
      extensionType: "engineering-note",
      extensionVersion: "1.0",
      extensionPayload: {
        component: "agent-communication",
        change: "foundation",
        validation: "node:test",
      },
    },
  });

  assert.equal(await prisma.importRun.count(), 0);
  assert.equal(await prisma.importSource.count(), 0);
  assert.equal(await prisma.canonicalSalesRecord.count(), 0);
  assert.equal(await prisma.product.count(), 0);
  assert.equal(await prisma.sale.count(), 0);
  assert.equal(await prisma.saleItem.count(), 0);
  assert.equal(await prisma.snapshot.count(), 0);
});
