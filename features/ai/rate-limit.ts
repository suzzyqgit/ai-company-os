import { prisma } from "@/lib/prisma";

const minuteLimit = 3;
const dailyLimit = 20;

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

  if (recentCount >= minuteLimit) {
    return {
      allowed: false,
      message: "AI分析の実行回数が多すぎます。少し待ってから再実行してください。",
    };
  }

  if (dailyCount >= dailyLimit) {
    return {
      allowed: false,
      message: "本日のAI分析上限に達しました。明日以降に再実行してください。",
    };
  }

  return { allowed: true, message: null };
}
