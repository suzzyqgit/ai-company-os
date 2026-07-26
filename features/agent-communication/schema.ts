export const coreMessageSchemaVersion = "agent-message-core-v1";

export const agentMessageTypes = [
  "STATUS_UPDATE",
  "REQUEST",
  "RESPONSE",
  "DECISION",
  "REVIEW",
  "APPROVAL",
  "CHANGE_REQUEST",
  "HANDOFF",
] as const;

export type AgentMessageTypeValue = (typeof agentMessageTypes)[number];

export const agentExtensionDefinitions = [
  {
    extensionType: "cmo-reference",
    extensionVersion: "1.0",
    ownerRole: "CMO",
    description: "CMO reference payload for marketing context and evidence.",
    requiredFields: ["referenceType", "referenceId", "source", "summary"],
  },
  {
    extensionType: "cpo-context",
    extensionVersion: "1.0",
    ownerRole: "CPO",
    description: "CPO product context payload.",
    requiredFields: ["productArea", "customerProblem", "expectedOutcome"],
  },
  {
    extensionType: "ceo-decision",
    extensionVersion: "1.0",
    ownerRole: "CEO",
    description: "CEO decision payload.",
    requiredFields: ["decision", "rationale", "status"],
  },
  {
    extensionType: "architecture-review",
    extensionVersion: "1.0",
    ownerRole: "ARCHITECTURE",
    description: "Architecture review payload.",
    requiredFields: ["scope", "risk", "recommendation"],
  },
  {
    extensionType: "engineering-note",
    extensionVersion: "1.0",
    ownerRole: "ENGINEERING",
    description: "Engineering implementation note payload.",
    requiredFields: ["component", "change", "validation"],
  },
] as const;

export type AgentExtensionDefinition = (typeof agentExtensionDefinitions)[number];

export type CoreAgentMessageInput = {
  messageType: AgentMessageTypeValue;
  content: string;
  summary?: string | null;
  extensionType?: string | null;
  extensionVersion?: string | null;
  extensionPayload?: unknown;
};

export type AgentCommunicationValidation = {
  ok: boolean;
  issues: string[];
};

const messageTypeSet = new Set<string>(agentMessageTypes);

export function getExtensionDefinition({
  extensionType,
  extensionVersion,
}: {
  extensionType: string;
  extensionVersion: string;
}) {
  return (
    agentExtensionDefinitions.find(
      (definition) =>
        definition.extensionType === extensionType &&
        definition.extensionVersion === extensionVersion,
    ) ?? null
  );
}

export function serializeExtensionSchema(definition: AgentExtensionDefinition) {
  return JSON.stringify({
    type: "object",
    additionalProperties: true,
    required: [...definition.requiredFields],
    properties: Object.fromEntries(
      definition.requiredFields.map((field) => [field, { type: "string" }]),
    ),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateExtensionPayload({
  extensionType,
  extensionVersion,
  extensionPayload,
}: {
  extensionType: string;
  extensionVersion: string;
  extensionPayload: unknown;
}): AgentCommunicationValidation {
  const definition = getExtensionDefinition({ extensionType, extensionVersion });
  const issues: string[] = [];

  if (!definition) {
    return {
      ok: false,
      issues: ["extension_not_registered"],
    };
  }

  if (!isRecord(extensionPayload)) {
    return {
      ok: false,
      issues: ["extension_payload_must_be_object"],
    };
  }

  for (const field of definition.requiredFields) {
    if (typeof extensionPayload[field] !== "string" || extensionPayload[field].trim() === "") {
      issues.push(`extension_required_field_missing:${field}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateCoreAgentMessage(
  input: CoreAgentMessageInput,
): AgentCommunicationValidation {
  const issues: string[] = [];

  if (!messageTypeSet.has(input.messageType)) {
    issues.push("message_type_unsupported");
  }

  if (input.content.trim() === "") {
    issues.push("content_required");
  }

  const hasExtensionType = Boolean(input.extensionType);
  const hasExtensionVersion = Boolean(input.extensionVersion);
  const hasExtensionPayload = input.extensionPayload !== undefined && input.extensionPayload !== null;

  if (hasExtensionType || hasExtensionVersion || hasExtensionPayload) {
    if (!input.extensionType) issues.push("extension_type_required");
    if (!input.extensionVersion) issues.push("extension_version_required");
    if (!hasExtensionPayload) issues.push("extension_payload_required");

    if (input.extensionType && input.extensionVersion && hasExtensionPayload) {
      issues.push(
        ...validateExtensionPayload({
          extensionType: input.extensionType,
          extensionVersion: input.extensionVersion,
          extensionPayload: input.extensionPayload,
        }).issues,
      );
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
