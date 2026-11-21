export const minuteLimit = 3;
export const dailyLimit = 20;

export function evaluateAiRateLimit(recentCount: number, dailyCount: number): { allowed: boolean; message: string | null } {
  if (recentCount >= minuteLimit) {
    return { allowed: false, message: "AI分析の実行回数が多すぎます。少し待ってから再実行してください。" };
  } else if (dailyCount >= dailyLimit) {
    return { allowed: false, message: "本日のAI分析上限に達しました。明日以降に再実行してください。" };
  } else {
    return { allowed: true, message: null };
  }
}
