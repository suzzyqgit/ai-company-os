import { prisma } from "@/lib/prisma";
import { evaluateAiRateLimit } from "./rate-limit-policy";

export async function assertAiRateLimit() {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [recentCount, dailyCount] = await Promise.all([
    prisma.aiAnalysisRun.count({
      where: {
        createdAt: {
          gte: oneMinuteAgo,
        },
      },
    }),
    prisma.aiAnalysisRun.count({
      where: {
        createdAt: {
          gte: startOfDay,
        },
      },
    }),
  ]);

  return evaluateAiRateLimit(recentCount, dailyCount);
}
