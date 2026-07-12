import type { NoteProfileArticle } from "./types";

type NoteCreatorResponse = {
  data?: {
    urlname?: string;
    noteCount?: number;
  };
};

type NoteContentsResponse = {
  data?: {
    contents?: Array<{
      key?: string | number;
      name?: string;
      noteUrl?: string;
      price?: number | null;
      status?: string;
    }>;
    isLastPage?: boolean;
    totalCount?: number;
  };
};

const noteProfilePattern = /^https:\/\/note\.com\/([^/?#]+)\/?$/;

function parseProfileUrl(profileUrl: string) {
  const trimmed = profileUrl.trim();
  const match = noteProfilePattern.exec(trimmed);

  if (!match) {
    return null;
  }

  return {
    profileUrl: `https://note.com/${match[1]}`,
    urlname: match[1],
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "note-tools/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`note API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchNoteProfileArticles(profileUrl: string) {
  const parsed = parseProfileUrl(profileUrl);

  if (!parsed) {
    throw new Error("Invalid note profile URL");
  }

  const creator = await fetchJson<NoteCreatorResponse>(
    `https://note.com/api/v2/creators/${encodeURIComponent(parsed.urlname)}`,
  );
  const urlname = creator.data?.urlname ?? parsed.urlname;
  const publicArticles: NoteProfileArticle[] = [];
  const seenNoteUrls = new Set<string>();
  let page = 1;
  let isLastPage = false;
  let totalPublicArticles = creator.data?.noteCount ?? 0;

  while (!isLastPage && page <= 100) {
    const contents = await fetchJson<NoteContentsResponse>(
      `https://note.com/api/v2/creators/${encodeURIComponent(
        urlname,
      )}/contents?kind=note&page=${page}`,
    );

    totalPublicArticles = contents.data?.totalCount ?? totalPublicArticles;
    isLastPage = contents.data?.isLastPage ?? true;

    (contents.data?.contents ?? []).forEach((content) => {
      if (
        content.status &&
        content.status !== "published" &&
        content.status !== "public"
      ) {
        return;
      }

      if (!content.name || !content.noteUrl) {
        return;
      }

      if (seenNoteUrls.has(content.noteUrl)) {
        return;
      }

      seenNoteUrls.add(content.noteUrl);
      publicArticles.push({
        title: content.name.trim(),
        noteUrl: content.noteUrl,
        price: Math.max(0, Math.trunc(Number(content.price ?? 0))),
        key: String(content.key ?? content.noteUrl),
      });
    });

    page += 1;
  }

  return {
    profileUrl: parsed.profileUrl,
    urlname,
    totalPublicArticles,
    publicArticles,
  };
}
