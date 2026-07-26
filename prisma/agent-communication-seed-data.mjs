export const agentRegistrySeed = [
  {
    key: "CEO",
    displayName: "CEO",
    role: "CEO",
    status: "ACTIVE",
    description: "Executive decision agent.",
  },
  {
    key: "CPO",
    displayName: "CPO",
    role: "CPO",
    status: "ACTIVE",
    description: "Product strategy agent.",
  },
  {
    key: "CMO",
    displayName: "CMO",
    role: "CMO",
    status: "ACTIVE",
    description: "Marketing strategy agent.",
  },
  {
    key: "CHIEF_AI_ARCHITECT",
    displayName: "Chief AI Architect",
    role: "ARCHITECTURE",
    status: "ACTIVE",
    description: "Architecture and governance review agent.",
  },
  {
    key: "CODEX",
    displayName: "Codex",
    role: "ENGINEERING",
    status: "ACTIVE",
    description: "Implementation agent.",
  },
  {
    key: "SYSTEM",
    displayName: "System",
    role: "SYSTEM",
    status: "ACTIVE",
    description: "System communication actor.",
  },
];

export const communicationPolicySeed = [
  {
    key: "agent-communication-default",
    name: "Agent Communication Default Policy",
    description: "Default policy for repository-local agent communication.",
    appliesToAgentKey: null,
    allowedMessageTypes: JSON.stringify([
      "STATUS_UPDATE",
      "REQUEST",
      "RESPONSE",
      "DECISION",
      "REVIEW",
      "APPROVAL",
      "CHANGE_REQUEST",
      "HANDOFF",
    ]),
    allowedExtensionTypes: JSON.stringify([
      "cmo-reference",
      "cpo-context",
      "ceo-decision",
      "architecture-review",
      "engineering-note",
    ]),
    retentionPolicy: "repository_retained_until_owner_archive",
    status: "ACTIVE",
  },
];

export const extensionRegistrySeed = [
  {
    extensionType: "cmo-reference",
    extensionVersion: "1.0",
    ownerRole: "CMO",
    description: "CMO reference payload for marketing context and evidence.",
    jsonSchema: JSON.stringify({
      type: "object",
      additionalProperties: true,
      required: ["referenceType", "referenceId", "source", "summary"],
      properties: {
        referenceType: { type: "string" },
        referenceId: { type: "string" },
        source: { type: "string" },
        summary: { type: "string" },
      },
    }),
    status: "ACTIVE",
  },
  {
    extensionType: "cpo-context",
    extensionVersion: "1.0",
    ownerRole: "CPO",
    description: "CPO product context payload.",
    jsonSchema: JSON.stringify({
      type: "object",
      additionalProperties: true,
      required: ["productArea", "customerProblem", "expectedOutcome"],
      properties: {
        productArea: { type: "string" },
        customerProblem: { type: "string" },
        expectedOutcome: { type: "string" },
      },
    }),
    status: "ACTIVE",
  },
  {
    extensionType: "ceo-decision",
    extensionVersion: "1.0",
    ownerRole: "CEO",
    description: "CEO decision payload.",
    jsonSchema: JSON.stringify({
      type: "object",
      additionalProperties: true,
      required: ["decision", "rationale", "status"],
      properties: {
        decision: { type: "string" },
        rationale: { type: "string" },
        status: { type: "string" },
      },
    }),
    status: "ACTIVE",
  },
  {
    extensionType: "architecture-review",
    extensionVersion: "1.0",
    ownerRole: "ARCHITECTURE",
    description: "Architecture review payload.",
    jsonSchema: JSON.stringify({
      type: "object",
      additionalProperties: true,
      required: ["scope", "risk", "recommendation"],
      properties: {
        scope: { type: "string" },
        risk: { type: "string" },
        recommendation: { type: "string" },
      },
    }),
    status: "ACTIVE",
  },
  {
    extensionType: "engineering-note",
    extensionVersion: "1.0",
    ownerRole: "ENGINEERING",
    description: "Engineering implementation note payload.",
    jsonSchema: JSON.stringify({
      type: "object",
      additionalProperties: true,
      required: ["component", "change", "validation"],
      properties: {
        component: { type: "string" },
        change: { type: "string" },
        validation: { type: "string" },
      },
    }),
    status: "ACTIVE",
  },
];

const keyPattern = /^[A-Z][A-Z0-9_]*$/;
const extensionTypePattern = /^[a-z][a-z0-9-]*$/;

export function validateAgentCommunicationSeedData() {
  for (const agent of agentRegistrySeed) {
    if (!keyPattern.test(agent.key)) {
      throw new Error(`Invalid agent key: ${agent.key}`);
    }
  }

  for (const extension of extensionRegistrySeed) {
    if (!extensionTypePattern.test(extension.extensionType)) {
      throw new Error(`Invalid extension type: ${extension.extensionType}`);
    }
    JSON.parse(extension.jsonSchema);
  }

  for (const policy of communicationPolicySeed) {
    JSON.parse(policy.allowedMessageTypes);
    JSON.parse(policy.allowedExtensionTypes);
  }
}
