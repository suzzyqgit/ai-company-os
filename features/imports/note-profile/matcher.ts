import type {
  ArticleMatchMethod,
  NoteProfileArticle,
  NoteProfileMatchedArticle,
  NoteProfileMissingArticle,
} from "./types";

type ExistingArticle = {
  id: string;
  title: string;
  noteUrl: string;
};

const symbolPattern = /[\s\u3000!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~「」『』【】（）［］｛｝、。，．・…〜～！？：；]/g;

export function normalizeArticleTitle(title: string) {
  return title.trim().toLowerCase().replace(symbolPattern, "");
}

function bigrams(value: string) {
  const text = normalizeArticleTitle(value);

  if (text.length <= 1) {
    return new Set(text ? [text] : []);
  }

  const result = new Set<string>();
  for (let index = 0; index < text.length - 1; index += 1) {
    result.add(text.slice(index, index + 2));
  }

  return result;
}

function diceCoefficient(a: string, b: string) {
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);

  if (aBigrams.size === 0 || bBigrams.size === 0) {
    return 0;
  }

  let intersection = 0;
  aBigrams.forEach((bigram) => {
    if (bBigrams.has(bigram)) {
      intersection += 1;
    }
  });

  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

function findBestMatch(
  publicArticle: NoteProfileArticle,
  articles: ExistingArticle[],
  usedArticleIds: Set<string>,
) {
  const candidates = articles.filter((article) => !usedArticleIds.has(article.id));
  const title = publicArticle.title.trim();
  const normalizedTitle = normalizeArticleTitle(publicArticle.title);

  const exact = candidates.find((article) => article.title.trim() === title);
  if (exact) {
    return { article: exact, method: "exact" as const, confidence: 1 };
  }

  const normalized = candidates.find(
    (article) => normalizeArticleTitle(article.title) === normalizedTitle,
  );
  if (normalized) {
    return { article: normalized, method: "normalized" as const, confidence: 0.95 };
  }

  const partial = candidates.find((article) => {
    const candidateTitle = normalizeArticleTitle(article.title);

    return (
      normalizedTitle.length >= 8 &&
      candidateTitle.length >= 8 &&
      (normalizedTitle.includes(candidateTitle) ||
        candidateTitle.includes(normalizedTitle))
    );
  });
  if (partial) {
    return { article: partial, method: "partial" as const, confidence: 0.82 };
  }

  const similar = candidates
    .map((article) => ({
      article,
      score: diceCoefficient(publicArticle.title, article.title),
    }))
    .filter((candidate) => candidate.score >= 0.72)
    .sort((a, b) => b.score - a.score)[0];

  if (similar) {
    return {
      article: similar.article,
      method: "similarity" as const,
      confidence: Number(similar.score.toFixed(2)),
    };
  }

  return null;
}

function shouldUpdateNoteUrl(currentNoteUrl: string, nextNoteUrl: string) {
  return currentNoteUrl.trim() === "" || currentNoteUrl.trim() !== nextNoteUrl;
}

export function matchPublicArticlesToArticles({
  publicArticles,
  articles,
}: {
  publicArticles: NoteProfileArticle[];
  articles: ExistingArticle[];
}) {
  const usedArticleIds = new Set<string>();
  const matchedArticles: NoteProfileMatchedArticle[] = [];
  const missingArticles: NoteProfileMissingArticle[] = [];

  publicArticles.forEach((publicArticle) => {
    const match = findBestMatch(publicArticle, articles, usedArticleIds);

    if (!match) {
      missingArticles.push({
        publicArticle,
        matchMethod: "none",
        confidence: 0,
      });
      return;
    }

    usedArticleIds.add(match.article.id);
    matchedArticles.push({
      publicArticle,
      articleId: match.article.id,
      articleTitle: match.article.title,
      currentNoteUrl: match.article.noteUrl,
      matchMethod: match.method satisfies Exclude<ArticleMatchMethod, "none">,
      confidence: match.confidence,
      shouldUpdateNoteUrl: shouldUpdateNoteUrl(
        match.article.noteUrl,
        publicArticle.noteUrl,
      ),
    });
  });

  return {
    matchedArticles,
    missingArticles,
  };
}
