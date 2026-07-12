"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  generateFreeArticleDraft,
  generateFreeArticleIdeas,
  type FreeArticleDestination,
} from "@/features/free-article-generator/generator";
import { getFreeArticleGenerationHistory } from "@/features/free-article-generator/queries";

type GeneratedIdeaView = {
  id: string;
  theme: string;
  title: string;
  searchIntent: string;
  targetReader: string;
  readerProblem: string;
  angle: string;
  funnelRole: string;
  expectedCta: string;
  priority: string;
  duplicateScore: number;
  titleSimilarityScore: number;
};

export type FreeArticleGeneratorActionState = {
  formError?: string;
  fieldErrors?: Partial<
    Record<
      "destinationArticleId" | "ctaStrength" | "expectedLength" | "tone" | "memo",
      string
    >
  >;
  result?: {
    destinationArticle: {
      id: string;
      title: string;
      noteUrl: string;
      price: number;
      pv: number;
      purchases: number;
      conversionRate: number;
      status: string;
      updatedAt: string;
    };
    ctaStrength: string;
    expectedLength: number;
    tone: string;
    memo: string;
    focusCategory: string;
    ideas: GeneratedIdeaView[];
  };
};

export type FreeArticleSaveActionState = {
  formError?: string;
  result?: {
    id: string;
    title: string;
    titleIdeas: string[];
    outline: string;
    fullDraft: string;
    destinationNoteUrl: string;
  };
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseExpectedLength(value: string) {
  const expectedLength = Number(value);

  if (!Number.isInteger(expectedLength) || expectedLength <= 0) {
    return null;
  }

  return expectedLength;
}

function calculateConversionRate(purchases: number, pv: number) {
  if (pv === 0) {
    return 0;
  }

  return (purchases / pv) * 100;
}

async function getDestinationArticle(destinationArticleId: string) {
  const article = await prisma.article.findUnique({
    where: {
      id: destinationArticleId,
    },
    select: {
      id: true,
      title: true,
      noteUrl: true,
      note: true,
      price: true,
      pv: true,
      purchases: true,
      status: true,
      updatedAt: true,
    },
  });

  if (!article) {
    return null;
  }

  return {
    ...article,
    conversionRate: calculateConversionRate(article.purchases, article.pv),
  };
}

function toIdeaView(idea: GeneratedIdeaView): GeneratedIdeaView {
  return {
    id: idea.id,
    theme: idea.theme,
    title: idea.title,
    searchIntent: idea.searchIntent,
    targetReader: idea.targetReader,
    readerProblem: idea.readerProblem,
    angle: idea.angle,
    funnelRole: idea.funnelRole,
    expectedCta: idea.expectedCta,
    priority: idea.priority,
    duplicateScore: idea.duplicateScore,
    titleSimilarityScore: idea.titleSimilarityScore,
  };
}

export async function generateFreeArticleCandidatesAction(
  _previousState: FreeArticleGeneratorActionState,
  formData: FormData,
): Promise<FreeArticleGeneratorActionState> {
  void _previousState;

  const raw = {
    destinationArticleId: getString(formData, "destinationArticleId"),
    ctaStrength: getString(formData, "ctaStrength") || "standard",
    expectedLength: getString(formData, "expectedLength") || "1800",
    tone: getString(formData, "tone") || "practical",
    memo: getString(formData, "memo"),
    focusCategory: getString(formData, "focusCategory"),
  };
  const fieldErrors: FreeArticleGeneratorActionState["fieldErrors"] = {};
  const expectedLength = parseExpectedLength(raw.expectedLength);

  if (!raw.destinationArticleId) {
    fieldErrors.destinationArticleId = "送客先Articleは必須です。";
  }

  if (expectedLength === null) {
    fieldErrors.expectedLength = "想定文字数は1以上の整数で入力してください。";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const destinationArticle = await getDestinationArticle(raw.destinationArticleId);

  if (!destinationArticle) {
    return {
      fieldErrors: {
        destinationArticleId: "送客先Articleが見つかりません。",
      },
    };
  }

  if (!destinationArticle.noteUrl.trim()) {
    return {
      fieldErrors: {
        destinationArticleId:
          "送客先ArticleにnoteUrlが未設定のため、CTAを作れません。先にnoteUrlを登録してください。",
      },
    };
  }

  const history = await getFreeArticleGenerationHistory();
  const ideas = generateFreeArticleIdeas(
    destinationArticle,
    history,
    raw.focusCategory,
  );
  const createdIdeas = await prisma.$transaction(
    ideas.map((idea) =>
      prisma.freeArticleIdea.create({
        data: {
          destinationArticleId: destinationArticle.id,
          theme: idea.theme,
          title: idea.title,
          searchIntent: idea.searchIntent,
          targetReader: idea.targetReader,
          readerProblem: idea.readerProblem,
          angle: idea.angle,
          funnelRole: idea.funnelRole,
          expectedCta: idea.expectedCta,
          priority: idea.priority,
          duplicateScore: idea.duplicateScore,
          titleSimilarityScore: idea.titleSimilarityScore,
          status: "generated",
        },
        select: {
          id: true,
          theme: true,
          title: true,
          searchIntent: true,
          targetReader: true,
          readerProblem: true,
          angle: true,
          funnelRole: true,
          expectedCta: true,
          priority: true,
          duplicateScore: true,
          titleSimilarityScore: true,
        },
      }),
    ),
  );

  revalidatePath("/free-article-generator");

  return {
    result: {
      destinationArticle: {
        id: destinationArticle.id,
        title: destinationArticle.title,
        noteUrl: destinationArticle.noteUrl,
        price: destinationArticle.price,
        pv: destinationArticle.pv,
        purchases: destinationArticle.purchases,
        conversionRate: destinationArticle.conversionRate,
        status: destinationArticle.status,
        updatedAt: destinationArticle.updatedAt.toISOString(),
      },
      ctaStrength: raw.ctaStrength,
      expectedLength: expectedLength ?? 1800,
      tone: raw.tone,
      memo: raw.memo,
      focusCategory: raw.focusCategory,
      ideas: createdIdeas.map(toIdeaView),
    },
  };
}

export async function saveSelectedFreeArticleDraftAction(
  _previousState: FreeArticleSaveActionState,
  formData: FormData,
): Promise<FreeArticleSaveActionState> {
  void _previousState;

  const ideaId = getString(formData, "ideaId");
  const ctaStrength = getString(formData, "ctaStrength") || "standard";
  const expectedLength = parseExpectedLength(getString(formData, "expectedLength"));
  const tone = getString(formData, "tone") || "practical";
  const memo = getString(formData, "memo");

  if (!ideaId) {
    return { formError: "採用する無料記事候補を選択してください。" };
  }

  if (expectedLength === null) {
    return { formError: "想定文字数は1以上の整数で入力してください。" };
  }

  const idea = await prisma.freeArticleIdea.findUnique({
    where: {
      id: ideaId,
    },
    include: {
      destinationArticle: {
        select: {
          id: true,
          title: true,
          noteUrl: true,
          note: true,
          price: true,
          pv: true,
          purchases: true,
          status: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!idea) {
    return { formError: "採用する無料記事候補が見つかりません。" };
  }

  if (!idea.destinationArticle.noteUrl.trim()) {
    return { formError: "送客先ArticleにnoteUrlを設定してください。" };
  }

  const destinationArticle: FreeArticleDestination = {
    ...idea.destinationArticle,
    conversionRate: calculateConversionRate(
      idea.destinationArticle.purchases,
      idea.destinationArticle.pv,
    ),
  };
  const generated = generateFreeArticleDraft(
    {
      id: idea.id,
      theme: idea.theme,
      title: idea.title,
      searchIntent: idea.searchIntent,
      targetReader: idea.targetReader,
      readerProblem: idea.readerProblem,
      angle: idea.angle,
      funnelRole: idea.funnelRole,
      expectedCta: idea.expectedCta,
      priority: idea.priority,
      duplicateScore: idea.duplicateScore,
      titleSimilarityScore: idea.titleSimilarityScore,
    },
    {
      destinationArticle,
      ctaStrength,
      expectedLength,
      tone,
      memo,
    },
  );
  const [draft] = await prisma.$transaction([
    prisma.freeArticleDraft.upsert({
      where: {
        freeArticleIdeaId: idea.id,
      },
      create: {
        freeArticleIdeaId: idea.id,
        title: generated.title,
        theme: generated.theme,
        targetReader: generated.targetReader,
        readerProblem: generated.readerProblem,
        purpose: generated.purpose,
        destinationArticleId: destinationArticle.id,
        destinationNoteUrl: destinationArticle.noteUrl,
        titleIdeas: JSON.stringify(generated.titleIdeas),
        outline: generated.outline,
        body: generated.body,
        introduction: generated.introduction,
        headings: JSON.stringify(generated.headings),
        summary: generated.summary,
        cta: generated.cta,
        fullDraft: generated.fullDraft,
        status: "ready",
      },
      update: {
        title: generated.title,
        theme: generated.theme,
        targetReader: generated.targetReader,
        readerProblem: generated.readerProblem,
        purpose: generated.purpose,
        destinationNoteUrl: destinationArticle.noteUrl,
        titleIdeas: JSON.stringify(generated.titleIdeas),
        outline: generated.outline,
        body: generated.body,
        introduction: generated.introduction,
        headings: JSON.stringify(generated.headings),
        summary: generated.summary,
        cta: generated.cta,
        fullDraft: generated.fullDraft,
        status: "ready",
      },
      select: {
        id: true,
      },
    }),
    prisma.freeArticleIdea.update({
      where: {
        id: idea.id,
      },
      data: {
        status: "drafted",
      },
    }),
  ]);

  revalidatePath("/free-article-generator");

  return {
    result: {
      id: draft.id,
      title: generated.title,
      titleIdeas: generated.titleIdeas,
      outline: generated.outline,
      fullDraft: generated.fullDraft,
      destinationNoteUrl: destinationArticle.noteUrl,
    },
  };
}
