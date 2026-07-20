export const governanceActors = [
  { key: "OWNER", displayName: "Owner", actorType: "HUMAN", status: "ACTIVE" },
  { key: "CEO", displayName: "CEO", actorType: "AI", status: "ACTIVE" },
  { key: "CPO", displayName: "CPO", actorType: "AI", status: "ACTIVE" },
  { key: "CMO", displayName: "CMO", actorType: "AI", status: "ACTIVE" },
  {
    key: "CHIEF_AI_ARCHITECT",
    displayName: "Chief AI Architect",
    actorType: "AI",
    status: "ACTIVE",
  },
  { key: "CODEX", displayName: "Codex", actorType: "AI", status: "ACTIVE" },
  { key: "SYSTEM", displayName: "System", actorType: "SYSTEM", status: "ACTIVE" },
];

export const governanceRoles = [
  { key: "OWNER", name: "Owner", description: "Product owner and final operator." },
  { key: "CEO", name: "CEO", description: "Executive decision role." },
  { key: "PRODUCT", name: "Product", description: "Product planning role." },
  { key: "MARKETING", name: "Marketing", description: "Marketing operations role." },
  {
    key: "ARCHITECTURE",
    name: "Architecture",
    description: "System architecture and technical review role.",
  },
  {
    key: "IMPLEMENTATION",
    name: "Implementation",
    description: "Implementation execution role.",
  },
  { key: "SYSTEM", name: "System", description: "System maintenance role." },
];

export const governanceActorRoles = [
  { actorKey: "OWNER", roleKey: "OWNER" },
  { actorKey: "CEO", roleKey: "CEO" },
  { actorKey: "CPO", roleKey: "PRODUCT" },
  { actorKey: "CMO", roleKey: "MARKETING" },
  { actorKey: "CHIEF_AI_ARCHITECT", roleKey: "ARCHITECTURE" },
  { actorKey: "CODEX", roleKey: "IMPLEMENTATION" },
  { actorKey: "SYSTEM", roleKey: "SYSTEM" },
];

export const governancePermissions = [
  { key: "case.read", resource: "case", action: "read" },
  { key: "case.create", resource: "case", action: "create" },
  { key: "case.update", resource: "case", action: "update" },
  { key: "artifact.read", resource: "artifact", action: "read" },
  { key: "artifact.submit", resource: "artifact", action: "submit" },
  { key: "artifact.approve", resource: "artifact", action: "approve" },
  { key: "artifact.change", resource: "artifact", action: "change" },
  { key: "workitem.read", resource: "workitem", action: "read" },
  { key: "workitem.create", resource: "workitem", action: "create" },
  { key: "workitem.execute", resource: "workitem", action: "execute" },
  { key: "audit.read", resource: "audit", action: "read" },
  { key: "permission.read", resource: "permission", action: "read" },
];

export const governanceRolePermissions = [
  { roleKey: "OWNER", permissionKey: "permission.read" },
  { roleKey: "OWNER", permissionKey: "audit.read" },
  { roleKey: "CEO", permissionKey: "case.read" },
  { roleKey: "CEO", permissionKey: "case.create" },
  { roleKey: "CEO", permissionKey: "case.update" },
  { roleKey: "CEO", permissionKey: "artifact.read" },
  { roleKey: "CEO", permissionKey: "artifact.approve" },
  { roleKey: "PRODUCT", permissionKey: "case.read" },
  { roleKey: "PRODUCT", permissionKey: "artifact.read" },
  { roleKey: "PRODUCT", permissionKey: "artifact.submit" },
  { roleKey: "MARKETING", permissionKey: "case.read" },
  { roleKey: "MARKETING", permissionKey: "artifact.read" },
  { roleKey: "MARKETING", permissionKey: "artifact.submit" },
  { roleKey: "ARCHITECTURE", permissionKey: "case.read" },
  { roleKey: "ARCHITECTURE", permissionKey: "artifact.read" },
  { roleKey: "ARCHITECTURE", permissionKey: "artifact.submit" },
  { roleKey: "ARCHITECTURE", permissionKey: "workitem.read" },
  { roleKey: "ARCHITECTURE", permissionKey: "workitem.create" },
  { roleKey: "IMPLEMENTATION", permissionKey: "workitem.read" },
  { roleKey: "IMPLEMENTATION", permissionKey: "workitem.execute" },
  { roleKey: "SYSTEM", permissionKey: "permission.read" },
];

const actorOrRoleKeyPattern = /^[A-Z][A-Z0-9_]*$/;
const permissionKeyPattern = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/;

export function validateGovernanceSeedData() {
  for (const actor of governanceActors) {
    if (!actorOrRoleKeyPattern.test(actor.key)) {
      throw new Error(`Invalid actor key: ${actor.key}`);
    }
  }

  for (const role of governanceRoles) {
    if (!actorOrRoleKeyPattern.test(role.key)) {
      throw new Error(`Invalid role key: ${role.key}`);
    }
  }

  for (const permission of governancePermissions) {
    if (!permissionKeyPattern.test(permission.key)) {
      throw new Error(`Invalid permission key: ${permission.key}`);
    }

    if (permission.key !== `${permission.resource}.${permission.action}`) {
      throw new Error(`Permission key mismatch: ${permission.key}`);
    }
  }
}
