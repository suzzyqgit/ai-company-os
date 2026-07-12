"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ArticleFormActionState = {
  fieldErrors?: Partial<
    Record<
      "title" | "noteUrl" | "price" | "pv" | "purchases" | "updatedAt" | "memo",
      string
    >
  >;
  formError?: string;
};

export type DeleteArticleActionState = {
  formError?: string;
};

type ParsedArticleInput = {
  title: string;
  noteUrl: string;
  status: string;
  price: number;
  pv: number;
  purchases: number;
  updatedAt: Date;
  note: string;
};

const requiredFields = ["title", "price", "pv", "purchases", "updatedAt"] as const;
const numericFields = ["price", "pv", "purchases"] as const;
const fieldLabels = {
  title: "タイトル",
  noteUrl: "note URL",
  price: "価格",
  pv: "PV",
  purchases: "購入数",
  updatedAt: "更新日",
  memo: "メモ",
} as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseArticleFormData(formData: FormData) {
  const raw = {
    title: getString(formData, "title"),
    noteUrl: getString(formData, "noteUrl"),
    price: getString(formData, "price"),
    pv: getString(formData, "pv"),
    purchases: getString(formData, "purchases"),
    updatedAt: getString(formData, "updatedAt"),
    memo: getString(formData, "memo"),
  };
  const fieldErrors: ArticleFormActionState["fieldErrors"] = {};

  requiredFields.forEach((field) => {
    if (raw[field] === "") {
      fieldErrors[field] = `${fieldLabels[field]}は必須です。`;
    }
  });

  numericFields.forEach((field) => {
    if (raw[field] === "") {
      return;
    }

    const value = Number(raw[field]);
    if (!Number.isInteger(value)) {
      fieldErrors[field] = `${fieldLabels[field]}は整数で入力してください。`;
      return;
    }

    if (value < 0) {
      fieldErrors[field] = `${fieldLabels[field]}は0以上で入力してください。`;
    }
  });

  if (raw.noteUrl !== "") {
    try {
      const url = new URL(raw.noteUrl);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        fieldErrors.noteUrl = "note URLはhttpまたはhttpsのURLで入力してください。";
      }
    } catch {
      fieldErrors.noteUrl = "note URLは正しいURLで入力してください。";
    }
  }

  const updatedAt = new Date(`${raw.updatedAt}T00:00:00.000Z`);
  if (raw.updatedAt !== "" && Number.isNaN(updatedAt.getTime())) {
    fieldErrors.updatedAt = "更新日は正しい日付で入力してください。";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return {
    data: {
      title: raw.title,
      noteUrl: raw.noteUrl,
      status: "active",
      price: Number(raw.price),
      pv: Number(raw.pv),
      purchases: Number(raw.purchases),
      updatedAt,
      note: raw.memo,
    } satisfies ParsedArticleInput,
  };
}

export async function createArticleAction(
  _previousState: ArticleFormActionState,
  formData: FormData,
): Promise<ArticleFormActionState> {
  const parsed = parseArticleFormData(formData);

  if ("fieldErrors" in parsed) {
    return { fieldErrors: parsed.fieldErrors };
  }

  try {
    await prisma.article.create({
      data: parsed.data,
    });
  } catch {
    return {
      formError: "記事の保存に失敗しました。時間をおいてもう一度お試しください。",
    };
  }

  revalidatePath("/articles");
  redirect("/articles");
}

export async function updateArticleAction(
  id: string,
  _previousState: ArticleFormActionState,
  formData: FormData,
): Promise<ArticleFormActionState> {
  const parsed = parseArticleFormData(formData);

  if ("fieldErrors" in parsed) {
    return { fieldErrors: parsed.fieldErrors };
  }

  try {
    await prisma.article.update({
      where: { id },
      data: parsed.data,
    });
  } catch {
    return {
      formError: "記事の更新に失敗しました。対象の記事が存在するか確認してください。",
    };
  }

  revalidatePath("/articles");
  revalidatePath(`/articles/${id}`);
  redirect(`/articles/${id}`);
}

export async function deleteArticleAction(
  id: string,
  _previousState: DeleteArticleActionState,
): Promise<DeleteArticleActionState> {
  void _previousState;

  try {
    await prisma.article.delete({
      where: { id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return {
        formError: "削除対象の記事が見つかりませんでした。",
      };
    }

    return {
      formError: "記事の削除に失敗しました。時間をおいてもう一度お試しください。",
    };
  }

  revalidatePath("/articles");
  revalidatePath(`/articles/${id}`);
  redirect("/articles");
}
