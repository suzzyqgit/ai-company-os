import { PrismaClient } from "@prisma/client";
import {
  governanceActorRoles,
  governanceActors,
  governancePermissions,
  governanceRolePermissions,
  governanceRoles,
  validateGovernanceSeedData,
} from "./governance-seed-data.mjs";

const prisma = new PrismaClient();

async function seedGovernance() {
  validateGovernanceSeedData();

  for (const actor of governanceActors) {
    await prisma.actor.upsert({
      where: { key: actor.key },
      update: {
        displayName: actor.displayName,
        actorType: actor.actorType,
        status: actor.status,
      },
      create: actor,
    });
  }

  for (const role of governanceRoles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: {
        name: role.name,
        description: role.description,
      },
      create: role,
    });
  }

  for (const permission of governancePermissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
      create: permission,
    });
  }

  const actors = await prisma.actor.findMany();
  const roles = await prisma.role.findMany();
  const permissions = await prisma.permission.findMany();
  const actorByKey = new Map(actors.map((actor) => [actor.key, actor]));
  const roleByKey = new Map(roles.map((role) => [role.key, role]));
  const permissionByKey = new Map(
    permissions.map((permission) => [permission.key, permission]),
  );
  const systemActor = actorByKey.get("SYSTEM");

  if (!systemActor) {
    throw new Error("SYSTEM actor is required before assigning actor roles.");
  }

  for (const actorRole of governanceActorRoles) {
    const actor = actorByKey.get(actorRole.actorKey);
    const role = roleByKey.get(actorRole.roleKey);

    if (!actor || !role) {
      throw new Error(
        `ActorRole seed reference not found: ${actorRole.actorKey} -> ${actorRole.roleKey}`,
      );
    }

    await prisma.actorRole.upsert({
      where: {
        actorId_roleId: {
          actorId: actor.id,
          roleId: role.id,
        },
      },
      update: {
        assignedByActorId: systemActor.id,
      },
      create: {
        actorId: actor.id,
        roleId: role.id,
        assignedByActorId: systemActor.id,
      },
    });
  }

  for (const rolePermission of governanceRolePermissions) {
    const role = roleByKey.get(rolePermission.roleKey);
    const permission = permissionByKey.get(rolePermission.permissionKey);

    if (!role || !permission) {
      throw new Error(
        `RolePermission seed reference not found: ${rolePermission.roleKey} -> ${rolePermission.permissionKey}`,
      );
    }

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  const [actorCount, roleCount, permissionCount, actorRoleCount, rolePermissionCount] =
    await Promise.all([
      prisma.actor.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.actorRole.count(),
      prisma.rolePermission.count(),
    ]);

  console.log("Governance seed completed.");
  console.log(`Actors: ${actorCount}`);
  console.log(`Roles: ${roleCount}`);
  console.log(`Permissions: ${permissionCount}`);
  console.log(`ActorRoles: ${actorRoleCount}`);
  console.log(`RolePermissions: ${rolePermissionCount}`);
}

try {
  await seedGovernance();
} finally {
  await prisma.$disconnect();
}
