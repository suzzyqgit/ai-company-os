import OpenAI from "openai";
import { articleAnalysisJsonSchema, parseArticleAnalysisReport } from "./schemas";
import type { ArticleAnalysisReport } from "./schemas";
import { articleAnalysisInstructions, buildArticleAnalysisInputText } from "./prompts";
import type { ArticleAnalysisInput } from "./schemas";

export const defaultAiModel = process.env.OPENAI_DEFAULT_MODEL || "gpt-5.6";

type GenerateArticleAnalysisResult = {
  report: ArticleAnalysisReport;
  outputText: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

export class MissingOpenAiApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured");
    this.name = "MissingOpenAiApiKeyError";
  }
}

function createClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new MissingOpenAiApiKeyError();
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function generateArticleAnalysis(
  input: ArticleAnalysisInput,
): Promise<GenerateArticleAnalysisResult> {
  const client = createClient();
  const response = await client.responses.create({
    model: input.model,
    instructions: articleAnalysisInstructions,
    input: buildArticleAnalysisInputText(input),
    max_output_tokens: 1800,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "article_improvement_report",
        description: "A Japanese note article improvement report based on metrics.",
        schema: articleAnalysisJsonSchema,
        strict: true,
      },
    },
  });
  const outputText = response.output_text;
  const report = parseArticleAnalysisReport(outputText);

  return {
    report,
    outputText,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}
