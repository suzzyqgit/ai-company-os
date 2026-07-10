"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createInputHash } from "./hash";
import { MissingOpenAiApiKeyError, generateArticleAnalysis } from "./openai";
import {
  buildArticleAnalysisInput,
  getCachedSuccessfulAnalysis,
} from "./queries";
import { assertAiRateLimit } from "./rate-limit";

export type ArticleAiAnalysisActionState = {
  message?: string;
  error?: string;
  cached?: boolean;
};

export async function generateArticleAiAnalysisAction(
  articleId: string,
  _previousState: ArticleAiAnalysisActionState,
): Promise<ArticleAiAnalysisActionState> {
  void _previousState;

  const input = await buildArticleAnalysisInput(articleId);

  if (!input) {
    return {
      error: "記事が見つかりません。",
    };
  }

  const inputHash = createInputHash(input);
  const cachedRun = await getCachedSuccessfulAnalysis(inputHash);

  if (cachedRun) {
    revalidatePath(`/articles/${articleId}`);
    return {
      message: "同じ入力のAI改善レポートを再表示しました。",
      cached: true,
    };
  }

  const rateLimit = await assertAiRateLimit();

  if (!rateLimit.allowed) {
    return {
      error: rateLimit.message ?? "AI分析の実行上限に達しました。",
    };
  }

  const run = await prisma.aiAnalysisRun.create({
    data: {
      articleId,
      type: input.analysisType,
      status: "running",
      model: input.model,
      inputHash,
      inputJson: JSON.stringify(input),
    },
  });

  try {
    const result = await generateArticleAnalysis(input);

    await prisma.aiAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: "succeeded",
        outputJson: JSON.stringify(result.report),
        outputText: result.outputText,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      },
    });

    revalidatePath(`/articles/${articleId}`);
    return {
      message: "AI改善レポートを生成しました。",
    };
  } catch (error) {
    const safeMessage =
      error instanceof MissingOpenAiApiKeyError
        ? "OPENAI_API_KEYが未設定のため、AI分析を実行できません。"
        : "AI分析の生成に失敗しました。時間をおいて再実行してください。";

    await prisma.aiAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: safeMessage,
      },
    });

    revalidatePath(`/articles/${articleId}`);
    return {
      error: safeMessage,
    };
  }
}
