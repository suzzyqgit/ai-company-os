"use server";

import { fetchNoteProfileArticles } from "@/features/imports/note-profile/api";
import { matchPublicArticlesToArticles } from "@/features/imports/note-profile/matcher";
import {
  applyNoteProfileImport,
  getArticlesForNoteProfileMatching,
} from "@/features/imports/note-profile/queries";
import { revalidateNoteProfileImport } from "@/features/revalidation/paths";
import type {
  NoteProfileImportPayload,
  NoteProfileImportResult,
  NoteProfilePreview,
} from "@/features/imports/note-profile/types";

export type NoteProfileImportActionState = {
  formError?: string;
  preview?: NoteProfilePreview;
  result?: NoteProfileImportResult;
};

const defaultProfileUrl = "https://note.com/suzzysuzzy";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function encodePayload(payload: NoteProfileImportPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodePayload(value: string): NoteProfileImportPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as {
      profileUrl?: unknown;
      urlname?: unknown;
      publicArticles?: unknown;
    };

    if (
      typeof parsed.profileUrl !== "string" ||
      typeof parsed.urlname !== "string" ||
      !Array.isArray(parsed.publicArticles)
    ) {
      return null;
    }

    const publicArticles = parsed.publicArticles.filter((article) => {
      if (typeof article !== "object" || article === null) {
        return false;
      }

      const candidate = article as {
        title?: unknown;
        noteUrl?: unknown;
        price?: unknown;
        key?: unknown;
      };

      return (
        typeof candidate.title === "string" &&
        typeof candidate.noteUrl === "string" &&
        typeof candidate.price === "number" &&
        Number.isInteger(candidate.price) &&
        candidate.price >= 0 &&
        typeof candidate.key === "string"
      );
    });

    if (publicArticles.length !== parsed.publicArticles.length) {
      return null;
    }

    return {
      profileUrl: parsed.profileUrl,
      urlname: parsed.urlname,
      publicArticles,
    };
  } catch {
    return null;
  }
}

function decodeExistingUpdate(value: string) {
  const [articleId, noteUrl] = value.split("\t");

  if (!articleId || !noteUrl) {
    return null;
  }

  return {
    articleId,
    noteUrl,
  };
}

export async function previewNoteProfileImportAction(
  _previousState: NoteProfileImportActionState,
  formData: FormData,
): Promise<NoteProfileImportActionState> {
  void _previousState;

  const profileUrl = getString(formData, "profileUrl") || defaultProfileUrl;

  try {
    const [noteProfile, articles] = await Promise.all([
      fetchNoteProfileArticles(profileUrl),
      getArticlesForNoteProfileMatching(),
    ]);
    const matched = matchPublicArticlesToArticles({
      publicArticles: noteProfile.publicArticles,
      articles,
    });

    return {
      preview: {
        profileUrl: noteProfile.profileUrl,
        urlname: noteProfile.urlname,
        totalPublicArticles: noteProfile.totalPublicArticles,
        matchedArticles: matched.matchedArticles,
        missingArticles: matched.missingArticles,
        payload: encodePayload({
          profileUrl: noteProfile.profileUrl,
          urlname: noteProfile.urlname,
          publicArticles: noteProfile.publicArticles,
        }),
      },
    };
  } catch {
    return {
      formError:
        "note公開記事の取得に失敗しました。プロフィールURLまたは通信状態を確認してください。",
    };
  }
}

export async function executeNoteProfileImportAction(
  _previousState: NoteProfileImportActionState,
  formData: FormData,
): Promise<NoteProfileImportActionState> {
  void _previousState;

  const payload = decodePayload(getString(formData, "payload"));
  const selectedExistingUpdates = formData
    .getAll("existingArticle")
    .filter((value): value is string => typeof value === "string")
    .map(decodeExistingUpdate)
    .filter((value): value is { articleId: string; noteUrl: string } =>
      Boolean(value),
    );
  const selectedMissingNoteUrls = formData
    .getAll("createArticle")
    .filter((value): value is string => typeof value === "string");

  if (!payload) {
    return {
      formError: "プレビュー情報が壊れています。もう一度取得してください。",
    };
  }

  try {
    const result = await applyNoteProfileImport({
      publicArticles: payload.publicArticles,
      selectedExistingUpdates,
      selectedMissingNoteUrls,
    });

    revalidateNoteProfileImport();

    return {
      result,
    };
  } catch {
    return {
      formError: "Articleへの反映に失敗しました。時間をおいてもう一度お試しください。",
    };
  }
}
