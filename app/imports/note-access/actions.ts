"use server";

import { revalidatePath } from "next/cache";
import { findBestArticleMatch } from "@/features/imports/note-access/matcher";
import { runTesseractOcr } from "@/features/imports/note-access/ocr";
import { parseNoteAccessColumnOcrText } from "@/features/imports/note-access/parser";
import { preprocessNoteAccessImage } from "@/features/imports/note-access/preprocess";
import {
  applyNoteAccessImport,
  getArticlesForAccessImport,
} from "@/features/imports/note-access/queries";
import type {
  NoteAccessExtractedItem,
  NoteAccessImportPayload,
  NoteAccessImportResult,
  NoteAccessPreview,
} from "@/features/imports/note-access/types";

export type NoteAccessImportActionState = {
  formError?: string;
  preview?: NoteAccessPreview;
  result?: NoteAccessImportResult;
};

const maxFileSizeBytes = 8 * 1024 * 1024;
const maxTotalFileSizeBytes = 32 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function isFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && "arrayBuffer" in value && "name" in value;
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getHexSignature(buffer: Buffer) {
  return buffer
    .subarray(0, 16)
    .toString("hex")
    .toUpperCase();
}

function detectImageType(buffer: Buffer, fileType: string) {
  if (acceptedImageTypes.has(fileType)) {
    return {
      imageType: fileType,
      signatureMatch: "mime",
    };
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return {
      imageType: "image/png",
      signatureMatch: "png",
    };
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      imageType: "image/jpeg",
      signatureMatch: "jpeg",
    };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return {
      imageType: "image/webp",
      signatureMatch: "webp",
    };
  }

  return {
    imageType: null,
    signatureMatch: "none",
  };
}

function encodePayload(payload: NoteAccessImportPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodePayload(value: string): NoteAccessImportPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as {
      fileCount?: unknown;
      items?: unknown;
    };

    if (
      typeof parsed.fileCount !== "number" ||
      !Number.isInteger(parsed.fileCount) ||
      parsed.fileCount < 0 ||
      !Array.isArray(parsed.items)
    ) {
      return null;
    }

    const items = parsed.items.filter((item) => {
      if (typeof item !== "object" || item === null) {
        return false;
      }

      const candidate = item as Partial<NoteAccessImportPayload["items"][number]>;
      return (
        typeof candidate.sourceFileName === "string" &&
        typeof candidate.extractedTitle === "string" &&
        typeof candidate.normalizedTitle === "string" &&
        typeof candidate.extractedPv === "number" &&
        Number.isInteger(candidate.extractedPv) &&
        candidate.extractedPv >= 0 &&
        typeof candidate.rawText === "string"
      );
    });

    if (items.length !== parsed.items.length) {
      return null;
    }

    return { fileCount: parsed.fileCount, items };
  } catch {
    return null;
  }
}

function getTesseractErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ENOENT") || message.includes("command not found")) {
    return "Tesseract CLIが見つかりません。ローカルOCRにはtesseractコマンドのインストールが必要です。";
  }

  return "OCR処理に失敗しました。画像が読み取れる状態か、Tesseractの日本語データが利用できるか確認してください。";
}

export async function previewNoteAccessImportAction(
  _previousState: NoteAccessImportActionState,
  formData: FormData,
): Promise<NoteAccessImportActionState> {
  void _previousState;

  const files = formData.getAll("files").filter(isFile);

  if (files.length === 0) {
    return {
      formError: "アクセス状況のスクリーンショットを選択してください。",
    };
  }

  const oversizedFile = files.find((file) => file.size > maxFileSizeBytes);
  if (oversizedFile) {
    return {
      formError: `ファイルサイズ上限は1ファイル8MBです: ${oversizedFile.name}`,
    };
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (totalSize > maxTotalFileSizeBytes) {
    return {
      formError: "合計ファイルサイズ上限は32MBです。",
    };
  }

  try {
    const articles = await getArticlesForAccessImport();
    const extractedItems: NoteAccessExtractedItem[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const detected = detectImageType(buffer, file.type);

      console.info("[note-access] uploaded image inspection", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        signatureHex: getHexSignature(buffer),
        signatureMatch: detected.signatureMatch,
        acceptedImageType: detected.imageType,
      });

      if (!detected.imageType) {
        return {
          formError:
            "PNG/JPEG/WebP以外のファイルは取り込めません。画像のMIMEタイプを確認してください。",
        };
      }

      const preprocessed = await preprocessNoteAccessImage(buffer);
      console.info("[note-access] image preprocessing", {
        fileName: file.name,
        ...preprocessed.metadata,
      });

      const [titleText, pvText, tableText] = await Promise.all([
        runTesseractOcr({
          buffer: preprocessed.titleBuffer,
          imageType: preprocessed.imageType,
        }),
        runTesseractOcr({
          buffer: preprocessed.pvBuffer,
          imageType: preprocessed.imageType,
        }),
        runTesseractOcr({
          buffer: preprocessed.tableBuffer,
          imageType: preprocessed.imageType,
        }),
      ]);
      const rawText = [
        "[title-column]",
        titleText,
        "[pv-column]",
        pvText,
        "[table]",
        tableText,
      ].join("\n");
      console.info("[note-access] ocr text preview", {
        fileName: file.name,
        titleText: titleText.slice(0, 1000),
        pvText: pvText.slice(0, 1000),
        tableText: tableText.slice(0, 1000),
      });
      const parsedItems = parseNoteAccessColumnOcrText({
        titleText,
        pvText,
        fallbackText: tableText,
      });
      const usedAutoSelectedArticleIds = new Set<string>();

      parsedItems.forEach((parsedItem) => {
        const match = findBestArticleMatch(
          parsedItem.normalizedTitle,
          articles,
          usedAutoSelectedArticleIds,
        );
        const matchedArticleId =
          match?.shouldAutoSelect ? match.article.id : null;
        const currentPv = match?.article.pv ?? null;
        const warning =
          currentPv !== null && parsedItem.extractedPv < currentPv
            ? `抽出PVが現在値 ${currentPv} より小さいため、反映時は更新せず警告として保存します。`
            : null;

        console.info("[note-access] ocr row matching", {
          sourceFileName: file.name,
          originalOcr: parsedItem.originalOcrLine,
          normalizedTitle: parsedItem.normalizedTitle,
          extractedPv: parsedItem.extractedPv,
          matchedArticleTitle: match?.article.title ?? null,
          matchMethod: match?.method ?? null,
          similarity: match?.similarity ?? 0,
          confidence: match?.confidence ?? 0,
        });

        if (matchedArticleId) {
          usedAutoSelectedArticleIds.add(matchedArticleId);
        }

        extractedItems.push({
          sourceFileName: file.name,
          extractedTitle: parsedItem.extractedTitle,
          normalizedTitle: parsedItem.normalizedTitle,
          extractedPv: parsedItem.extractedPv,
          rawText,
          matchedArticleId,
          matchedArticleTitle: match?.article.title ?? null,
          matchMethod: match?.method ?? null,
          matchSimilarity: match?.similarity ?? 0,
          matchConfidence: match?.confidence ?? 0,
          currentPv,
          warning,
        });
      });
    }

    if (extractedItems.length === 0) {
      return {
        formError:
          "OCRは完了しましたが、記事タイトルとPVの組み合わせを抽出できませんでした。画像の範囲や解像度を確認してください。",
      };
    }

    return {
      preview: {
        items: extractedItems,
        articles,
        fileCount: files.length,
        payload: encodePayload({
          fileCount: files.length,
          items: extractedItems.map((item) => ({
            sourceFileName: item.sourceFileName,
            extractedTitle: item.extractedTitle,
            normalizedTitle: item.normalizedTitle,
            extractedPv: item.extractedPv,
            rawText: item.rawText,
          })),
        }),
      },
    };
  } catch (error) {
    return {
      formError: getTesseractErrorMessage(error),
    };
  }
}

export async function executeNoteAccessImportAction(
  _previousState: NoteAccessImportActionState,
  formData: FormData,
): Promise<NoteAccessImportActionState> {
  void _previousState;

  const payload = decodePayload(getString(formData, "payload"));

  if (!payload) {
    return {
      formError: "プレビュー情報が壊れています。もう一度OCRを実行してください。",
    };
  }

  const selectedItems = payload.items.map((item, index) => {
    const selectedArticleId = getString(formData, `articleId-${index}`) || null;
    const pvText = getString(formData, `pv-${index}`);
    const selectedPv = pvText === "" ? Number.NaN : Number(pvText);

    return {
      item,
      selectedArticleId,
      selectedPv,
    };
  });
  const invalidItem = selectedItems.find(
    (item) => !Number.isInteger(item.selectedPv) || item.selectedPv < 0,
  );

  if (invalidItem) {
    return {
      formError: `PVは0以上の整数で入力してください: ${invalidItem.item.extractedTitle}`,
    };
  }

  const articles = await getArticlesForAccessImport();
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const items = selectedItems.map(({ item, selectedArticleId, selectedPv }) => {
    const selectedArticle = selectedArticleId
      ? articleById.get(selectedArticleId)
      : null;
    const currentPv = selectedArticle?.pv ?? null;
    const warning =
      currentPv !== null && selectedPv < currentPv
        ? `抽出PVが現在値 ${currentPv} より小さいため、Article.pvは更新しません。`
        : null;

    return {
      sourceFileName: item.sourceFileName,
      extractedTitle: item.extractedTitle,
      normalizedTitle: item.normalizedTitle,
      extractedPv: item.extractedPv,
      rawText: item.rawText,
      matchedArticleId: selectedArticle?.id ?? null,
      matchedArticleTitle: selectedArticle?.title ?? null,
      matchMethod: null,
      matchSimilarity: 0,
      matchConfidence: 0,
      currentPv,
      warning,
      selectedArticleId: selectedArticle?.id ?? null,
      selectedPv,
    };
  });

  try {
    const result = await applyNoteAccessImport({
      fileCount: payload.fileCount,
      items,
    });

    revalidatePath("/");
    revalidatePath("/articles");
    revalidatePath("/analytics");

    return {
      result,
    };
  } catch {
    return {
      formError: "アクセス状況の反映に失敗しました。選択内容を確認してください。",
    };
  }
}
