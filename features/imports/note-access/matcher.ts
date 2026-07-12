import { normalizeOcrTitle, normalizeTitleForMatching } from "./normalizer";

type ArticleCandidate = {
  id: string;
  title: string;
  pv: number;
};

type MatchCandidate = {
  article: ArticleCandidate;
  method: string;
  score: number;
  length?: number;
};

function bigrams(value: string) {
  const text = normalizeTitleForMatching(value);

  if (text.length <= 1) {
    return new Set(text ? [text] : []);
  }

  const result = new Set<string>();
  for (let index = 0; index < text.length - 1; index += 1) {
    result.add(text.slice(index, index + 2));
  }

  return result;
}

function levenshteinSimilarity(a: string, b: string) {
  const left = normalizeTitleForMatching(a);
  const right = normalizeTitleForMatching(b);

  if (!left && !right) {
    return 1;
  }

  if (!left || !right) {
    return 0;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost,
      );
    }

    for (let index = 0; index <= right.length; index += 1) {
      previous[index] = current[index];
    }
  }

  const distance = previous[right.length];
  return 1 - distance / Math.max(left.length, right.length);
}

function jaccardSimilarity(a: string, b: string) {
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);

  if (aBigrams.size === 0 && bBigrams.size === 0) {
    return 1;
  }

  if (aBigrams.size === 0 || bBigrams.size === 0) {
    return 0;
  }

  let intersection = 0;
  aBigrams.forEach((bigram) => {
    if (bBigrams.has(bigram)) {
      intersection += 1;
    }
  });

  const union = new Set([...aBigrams, ...bBigrams]).size;
  return intersection / union;
}

function extractNumbers(value: string) {
  return Array.from(normalizeTitleForMatching(value).matchAll(/\d+/g)).map(
    (match) => match[0],
  );
}

function haveCompatibleNumbers(left: string, right: string) {
  const leftNumbers = extractNumbers(left);
  const rightNumbers = extractNumbers(right);

  if (leftNumbers.length === 0 || rightNumbers.length === 0) {
    return true;
  }

  return leftNumbers.every((number) => rightNumbers.includes(number));
}

function tokenizeTitle(value: string) {
  const normalized = normalizeTitleForMatching(value);
  return Array.from(
    new Set([
      ...Array.from(normalized.matchAll(/\d+/g)).map((match) => match[0]),
      ...normalized
        .split(/\d+/)
        .flatMap((part) => {
          if (part.length <= 1) {
            return part ? [part] : [];
          }

          const tokens: string[] = [];
          for (let index = 0; index < part.length - 1; index += 1) {
            tokens.push(part.slice(index, index + 2));
          }
          return tokens;
        }),
    ]),
  );
}

function commonTokenScore(left: string, right: string) {
  const leftTokens = tokenizeTitle(left);
  const rightTokens = tokenizeTitle(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightTokenSet = new Set(rightTokens);
  const commonTokens = leftTokens.filter((token) => rightTokenSet.has(token));
  const leftNumbers = extractNumbers(left);
  const rightNumbers = extractNumbers(right);
  const commonNumbers = leftNumbers.filter((number) => rightNumbers.includes(number));
  const denominator = Math.max(leftTokens.length, rightTokens.length);

  return Math.min(1, (commonTokens.length + commonNumbers.length * 2) / denominator);
}

function applyScoringAdjustments({
  candidate,
  extractedTitle,
  usedAutoSelectedArticleIds,
}: {
  candidate: MatchCandidate;
  extractedTitle: string;
  usedAutoSelectedArticleIds: Set<string>;
}) {
  const tokenScore = commonTokenScore(extractedTitle, candidate.article.title);
  const usedPenalty = usedAutoSelectedArticleIds.has(candidate.article.id) ? 0.2 : 0;
  const score = Math.max(candidate.score, candidate.score * 0.85 + tokenScore * 0.15);

  return {
    ...candidate,
    score: Math.max(0, score - usedPenalty),
  };
}

function createMatch(
  article: ArticleCandidate,
  method: string,
  similarity: number,
) {
  const roundedSimilarity = Number(similarity.toFixed(2));

  return {
    article,
    method,
    similarity: roundedSimilarity,
    confidence: roundedSimilarity,
    shouldAutoSelect: roundedSimilarity >= 0.8,
  };
}

function getNormalizedContainmentScore(left: string, right: string) {
  if (left.length < 4 || right.length < 4) {
    return null;
  }

  if (!haveCompatibleNumbers(left, right)) {
    return null;
  }

  if (left.startsWith(right) || right.startsWith(left)) {
    return {
      method: "前方一致",
      score: 0.95,
    };
  }

  if (left.endsWith(right) || right.endsWith(left)) {
    return {
      method: "後方一致",
      score: 0.95,
    };
  }

  if (left.includes(right) || right.includes(left)) {
    return {
      method: "部分一致",
      score: 0.95,
    };
  }

  return null;
}

export function findBestArticleMatch(
  extractedTitle: string,
  articles: ArticleCandidate[],
  usedAutoSelectedArticleIds = new Set<string>(),
) {
  const trimmedTitle = extractedTitle.trim();
  const normalizedOcrTitle = normalizeOcrTitle(extractedTitle);
  const normalizedTitle = normalizeTitleForMatching(extractedTitle);
  const exact = articles.find((article) => article.title === extractedTitle);

  if (exact) {
    const adjusted = applyScoringAdjustments({
      candidate: { article: exact, method: "完全一致", score: 1 },
      extractedTitle,
      usedAutoSelectedArticleIds,
    });
    return createMatch(adjusted.article, adjusted.method, adjusted.score);
  }

  const trim = articles.find((article) => article.title.trim() === trimmedTitle);
  if (trim) {
    const adjusted = applyScoringAdjustments({
      candidate: { article: trim, method: "trim一致", score: 0.98 },
      extractedTitle,
      usedAutoSelectedArticleIds,
    });
    return createMatch(adjusted.article, adjusted.method, adjusted.score);
  }

  const normalized = articles.find(
    (article) => normalizeTitleForMatching(article.title) === normalizedTitle,
  );
  if (normalized) {
    const adjusted = applyScoringAdjustments({
      candidate: { article: normalized, method: "正規化一致", score: 0.96 },
      extractedTitle,
      usedAutoSelectedArticleIds,
    });
    return createMatch(adjusted.article, adjusted.method, adjusted.score);
  }

  const partial = articles
    .map((article) => {
      const candidateTitle = normalizeTitleForMatching(article.title);
      const containment = getNormalizedContainmentScore(
        normalizedTitle,
        candidateTitle,
      );

      if (!containment) {
        return null;
      }

      return {
        article,
        ...containment,
        length: Math.max(normalizedTitle.length, candidateTitle.length),
      };
    })
    .filter((candidate): candidate is {
      article: ArticleCandidate;
      method: string;
      score: number;
      length: number;
    } => candidate !== null)
    .map((candidate) =>
      applyScoringAdjustments({
        candidate,
        extractedTitle,
        usedAutoSelectedArticleIds,
      }),
    )
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      return (b.length ?? 0) - (a.length ?? 0);
    })[0];

  if (partial) {
    return createMatch(partial.article, partial.method, partial.score);
  }

  const similar = articles
    .map((article) => {
      const levenshtein = levenshteinSimilarity(normalizedOcrTitle, article.title);
      const jaccard = jaccardSimilarity(normalizedOcrTitle, article.title);
      const score = Math.max(levenshtein, jaccard);

      return {
        article,
        method: score === levenshtein ? "Levenshtein" : "Jaccard",
        score,
      };
    })
    .map((candidate) =>
      applyScoringAdjustments({
        candidate,
        extractedTitle,
        usedAutoSelectedArticleIds,
      }),
    )
    .filter((candidate) => candidate.score >= 0.75)
    .sort((a, b) => b.score - a.score)[0];

  if (!similar) {
    return null;
  }

  return createMatch(similar.article, similar.method, similar.score);
}
