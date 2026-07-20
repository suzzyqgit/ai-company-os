import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import {
  governanceActorRoles,
  governanceActors,
  governancePermissions,
  governanceRolePermissions,
  governanceRoles,
} from "../../prisma/governance-seed-data.mjs";

const prisma = new PrismaClient();

const businessBaseline = {
  articleCount: 153,
  articleDailyMetricCount: 180,
  noteSaleTransactionCount: 216,
  freeArticleDraftCount: 7,
  freeArticleIdeaCount: 180,
  todayTaskCompletionCount: 2,
  dailyMetricPurchases: 216,
  dailyMetricRevenue: 201096,
  noteSaleTransactionAmount: 201096,
};

async function expectUniqueConstraintFailure(label, operation) {
  try {
    await operation();
    assert.fail(`${label} should fail with a unique constraint error.`);
  } catch (error) {
    assert.equal(error.code, "P2002", `${label} failed with unexpected error.`);
  }
}

async function main() {
  const governanceCounts = {
    actors: await prisma.actor.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    actorRoles: await prisma.actorRole.count(),
    rolePermissions: await prisma.rolePermission.count(),
  };

  assert.deepEqual(governanceCounts, {
    actors: governanceActors.length,
    roles: governanceRoles.length,
    permissions: governancePermissions.length,
    actorRoles: governanceActorRoles.length,
    rolePermissions: governanceRolePermissions.length,
  });

  const codexActor = await prisma.actor.findUnique({
    where: { key: "CODEX" },
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

  assert.ok(codexActor);
  assert.equal(codexActor.actorType, "AI");
  assert.equal(codexActor.status, "ACTIVE");
  assert.deepEqual(
    codexActor.actorRoles.map((actorRole) => actorRole.role.key),
    ["IMPLEMENTATION"],
  );
  assert.deepEqual(
    codexActor.actorRoles[0].role.rolePermissions
      .map((rolePermission) => rolePermission.permission.key)
      .sort(),
    ["workitem.execute", "workitem.read"],
  );

  const permissionMatrix = await prisma.role.findMany({
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
  const ownerPermissions = permissionMatrix
    .find((role) => role.key === "OWNER")
    ?.rolePermissions.map((rolePermission) => rolePermission.permission.key)
    .sort();
  assert.deepEqual(ownerPermissions, ["audit.read", "permission.read"]);

  const systemActorRole = await prisma.actorRole.findFirstOrThrow({
    where: {
      actor: { key: "SYSTEM" },
      role: { key: "SYSTEM" },
    },
    include: {
      assignedByActor: true,
    },
  });
  assert.equal(systemActorRole.assignedByActor?.key, "SYSTEM");

  const testActorKey = "TEST_INACTIVE_ACTOR";
  await prisma.actorRole.deleteMany({ where: { actor: { key: testActorKey } } });
  await prisma.actor.deleteMany({ where: { key: testActorKey } });
  const inactiveActor = await prisma.actor.create({
    data: {
      key: testActorKey,
      displayName: "Test Inactive Actor",
      actorType: "AI",
      status: "INACTIVE",
    },
  });
  const activeLookup = await prisma.actor.findFirst({
    where: {
      key: testActorKey,
      status: "ACTIVE",
    },
  });
  assert.equal(activeLookup, null);
  await prisma.actor.delete({ where: { id: inactiveActor.id } });

  const ownerActor = await prisma.actor.findUniqueOrThrow({ where: { key: "OWNER" } });
  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER" } });
  const readPermission = await prisma.permission.findUniqueOrThrow({
    where: { key: "permission.read" },
  });

  await expectUniqueConstraintFailure("Actor.key", () =>
    prisma.actor.create({
      data: {
        key: "OWNER",
        displayName: "Duplicate Owner",
        actorType: "HUMAN",
      },
    }),
  );
  await expectUniqueConstraintFailure("Permission.resource/action", () =>
    prisma.permission.create({
      data: {
        key: "permission.read.duplicate",
        resource: "permission",
        action: "read",
      },
    }),
  );
  await expectUniqueConstraintFailure("ActorRole.actorId/roleId", () =>
    prisma.actorRole.create({
      data: {
        actorId: ownerActor.id,
        roleId: ownerRole.id,
      },
    }),
  );
  await expectUniqueConstraintFailure("RolePermission.roleId/permissionId", () =>
    prisma.rolePermission.create({
      data: {
        roleId: ownerRole.id,
        permissionId: readPermission.id,
      },
    }),
  );

  const deleteRuleKeys = {
    actor: "TEST_DELETE_RULE_ACTOR",
    assigner: "TEST_DELETE_RULE_ASSIGNER",
    role: "TEST_DELETE_RULE_ROLE",
    permission: "testdeleterule.read",
  };
  await prisma.actorRole.deleteMany({
    where: {
      OR: [
        { actor: { key: deleteRuleKeys.actor } },
        { assignedByActor: { key: deleteRuleKeys.assigner } },
      ],
    },
  });
  await prisma.rolePermission.deleteMany({
    where: { role: { key: deleteRuleKeys.role } },
  });
  await prisma.actor.deleteMany({
    where: { key: { in: [deleteRuleKeys.actor, deleteRuleKeys.assigner] } },
  });
  await prisma.role.deleteMany({ where: { key: deleteRuleKeys.role } });
  await prisma.permission.deleteMany({ where: { key: deleteRuleKeys.permission } });

  const [deleteRuleActor, deleteRuleAssigner, deleteRuleRole, deleteRulePermission] =
    await Promise.all([
      prisma.actor.create({
        data: {
          key: deleteRuleKeys.actor,
          displayName: "Delete Rule Actor",
          actorType: "AI",
        },
      }),
      prisma.actor.create({
        data: {
          key: deleteRuleKeys.assigner,
          displayName: "Delete Rule Assigner",
          actorType: "AI",
        },
      }),
      prisma.role.create({
        data: {
          key: deleteRuleKeys.role,
          name: "Delete Rule Role",
        },
      }),
      prisma.permission.create({
        data: {
          key: deleteRuleKeys.permission,
          resource: "testdeleterule",
          action: "read",
        },
      }),
    ]);

  const deleteRuleActorRole = await prisma.actorRole.create({
    data: {
      actorId: deleteRuleActor.id,
      roleId: deleteRuleRole.id,
      assignedByActorId: deleteRuleAssigner.id,
    },
  });
  await prisma.rolePermission.create({
    data: {
      roleId: deleteRuleRole.id,
      permissionId: deleteRulePermission.id,
    },
  });

  await prisma.actor.delete({ where: { id: deleteRuleAssigner.id } });
  const actorRoleAfterAssignerDelete = await prisma.actorRole.findUniqueOrThrow({
    where: { id: deleteRuleActorRole.id },
  });
  assert.equal(actorRoleAfterAssignerDelete.assignedByActorId, null);

  await prisma.role.delete({ where: { id: deleteRuleRole.id } });
  assert.equal(
    await prisma.actorRole.count({ where: { actorId: deleteRuleActor.id } }),
    0,
  );
  assert.equal(
    await prisma.rolePermission.count({
      where: { permissionId: deleteRulePermission.id },
    }),
    0,
  );
  await prisma.actor.delete({ where: { id: deleteRuleActor.id } });
  await prisma.permission.delete({ where: { id: deleteRulePermission.id } });

  const querySource = await readFile(
    new URL("../../features/governance/queries.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    /\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/.test(
      querySource,
    ),
    false,
    "Governance query module must remain read-only.",
  );

  const [
    articleCount,
    articleDailyMetricCount,
    noteSaleTransactionCount,
    freeArticleDraftCount,
    freeArticleIdeaCount,
    todayTaskCompletionCount,
    dailyMetricAggregate,
    noteSaleAggregate,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.articleDailyMetric.count(),
    prisma.noteSaleTransaction.count(),
    prisma.freeArticleDraft.count(),
    prisma.freeArticleIdea.count(),
    prisma.todayTaskCompletion.count(),
    prisma.articleDailyMetric.aggregate({
      _sum: { purchases: true, revenue: true },
    }),
    prisma.noteSaleTransaction.aggregate({
      _sum: { amount: true },
    }),
  ]);

  assert.deepEqual(
    {
      articleCount,
      articleDailyMetricCount,
      noteSaleTransactionCount,
      freeArticleDraftCount,
      freeArticleIdeaCount,
      todayTaskCompletionCount,
      dailyMetricPurchases: dailyMetricAggregate._sum.purchases,
      dailyMetricRevenue: dailyMetricAggregate._sum.revenue,
      noteSaleTransactionAmount: noteSaleAggregate._sum.amount,
    },
    businessBaseline,
  );

  console.log("Governance tests passed.");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
