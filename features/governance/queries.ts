import { prisma } from "@/lib/prisma";

export async function getActorByKey(actorKey: string) {
  return prisma.actor.findUnique({
    where: { key: actorKey },
    include: {
      actorRoles: {
        include: {
          role: true,
        },
        orderBy: {
          role: {
            key: "asc",
          },
        },
      },
    },
  });
}

export async function getActiveActorByKey(actorKey: string) {
  return prisma.actor.findFirst({
    where: {
      key: actorKey,
      status: "ACTIVE",
    },
    include: {
      actorRoles: {
        include: {
          role: true,
        },
        orderBy: {
          role: {
            key: "asc",
          },
        },
      },
    },
  });
}

export async function getRoleByKey(roleKey: string) {
  return prisma.role.findUnique({
    where: { key: roleKey },
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
        orderBy: {
          permission: {
            key: "asc",
          },
        },
      },
    },
  });
}

export async function getPermissionByKey(permissionKey: string) {
  return prisma.permission.findUnique({
    where: { key: permissionKey },
  });
}

export async function getPermissionMatrix() {
  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: {
      key: "asc",
    },
  });

  return roles.map((role) => ({
    roleKey: role.key,
    roleName: role.name,
    permissions: role.rolePermissions
      .map((rolePermission) => rolePermission.permission.key)
      .sort((left, right) => left.localeCompare(right)),
  }));
}

export async function getActorPermissionSnapshot(actorKey: string) {
  const actor = await prisma.actor.findUnique({
    where: { key: actorKey },
    include: {
      actorRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!actor) {
    return null;
  }

  const roleKeys = actor.actorRoles
    .map((actorRole) => actorRole.role.key)
    .sort((left, right) => left.localeCompare(right));
  const permissionKeys = Array.from(
    new Set(
      actor.actorRoles.flatMap((actorRole) =>
        actorRole.role.rolePermissions.map(
          (rolePermission) => rolePermission.permission.key,
        ),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return {
    actorKey: actor.key,
    actorType: actor.actorType,
    status: actor.status,
    roleKeys,
    permissionKeys,
  };
}
