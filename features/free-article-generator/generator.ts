export type FreeArticleDestination = {
  id: string;
  title: string;
  noteUrl: string;
  note: string;
  price: number;
  pv: number;
  purchases: number;
  conversionRate: number;
  status: string;
  updatedAt: Date;
};

export type FreeArticleHistory = {
  draftTitles: string[];
  draftThemes: string[];
  articleTitles: string[];
};

export type FreeArticleIdeaInput = {
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

export type FreeArticleIdeaForDraft = FreeArticleIdeaInput & {
  id?: string;
};

export type FreeArticleDraftContext = {
  destinationArticle: FreeArticleDestination;
  ctaStrength: string;
  expectedLength: number;
  tone: string;
  memo: string;
};

export type GeneratedFreeArticleDraft = {
  titleIdeas: string[];
  title: string;
  theme: string;
  targetReader: string;
  readerProblem: string;
  purpose: string;
  outline: string;
  body: string;
  introduction: string;
  headings: string[];
  summary: string;
  cta: string;
  fullDraft: string;
};

export type FreeArticleDuplicationMetrics = {
  exactDuplicateSentences: number;
  similarSentencePairs: number;
  similarParagraphPairs: number;
  headingClaimDuplicatePairs: number;
  phraseRepetitionScore: number;
  productNameCount: number;
  reusedExampleCount: number;
  bannedPhraseCount: number;
  overallDuplicationScore: number;
  qualityScore: number;
};

export type FreeArticleConversionQualityMetrics = {
  readThroughScore: number;
  referralScore: number;
  empathyScore: number;
  specificityScore: number;
  tempoScore: number;
  ctaScore: number;
  aiSmellScore: number;
  informationBoundaryScore: number;
  overallQualityScore: number;
};

export function stripLeadingMarkdownH1(text: string) {
  return text.replace(/^\s*#\s+[^\n]+(?:\n{1,2}|$)/, "").trimStart();
}

export const FREE_ARTICLE_CTA_URL =
  "https://note.com/suzzysuzzy/n/nfe45039c90f8";

export interface FreeArticleGenerator {
  generateIdeas(
    article: FreeArticleDestination,
    history: FreeArticleHistory,
    focusCategory?: string,
  ): FreeArticleIdeaInput[];
  generateDraft(
    idea: FreeArticleIdeaForDraft,
    context: FreeArticleDraftContext,
  ): GeneratedFreeArticleDraft;
}

const searchIntents = [
  "悩み解決",
  "初心者向け",
  "比較",
  "失敗回避",
  "手順解説",
  "事例",
  "チェックリスト",
  "用語解説",
  "トレンド",
  "導入前の不安解消",
];

const funnelRoles = [
  "認知",
  "興味",
  "比較検討",
  "購入前教育",
  "980円記事への送客",
];

const angleTemplates = [
  "悩みを1つに絞って入口を作る",
  "初心者が最初につまずく壁を見せる",
  "似た選択肢で迷う場面を比べる",
  "やりがちな失敗を先に避ける",
  "実践前の手順だけを見せる",
  "よくあるケースで自分ごと化する",
  "購入前の確認項目に落とし込む",
  "前提用語を会話っぽくほどく",
  "今なぜ必要かを短く伝える",
  "導入前の不安をほどく",
  "無料情報で止まる原因を説明する",
  "自己流で遠回りしない見方を示す",
  "購入後に成果を出す準備を促す",
  "今の状態を診断できる形にする",
  "具体例から必要性を感じてもらう",
  "最初の一歩だけに絞る",
  "避けるべき選び方を明確にする",
  "向いている人と向いていない人を分ける",
  "よくある誤解を解く",
  "次に読むべき理由を作る",
];

const productAliases = ["この記事", "有料版", "詳細版", "続き"];
const bannedAiPhrases = [
  "この記事では",
  "解説します",
  "ご紹介します",
  "重要です",
  "大切です",
  "まとめると",
  "ぜひ参考にしてください",
  "活用しましょう",
  "理解できます",
];
const genericTitleWords = [
  "最新版",
  "完全版",
  "改訂版",
  "公開版",
  "note",
  "プロンプト",
  "テンプレート",
];
const productTitleNoisePatterns = [
  /【[^】]*】/g,
  /\[[^\]]*\]/g,
  /（[^）]*(?:円|税込|特典|限定|販売|公開版|完全版)[^）]*）/g,
  /\([^)]*(?:円|税込|特典|限定|販売|公開版|完全版)[^)]*\)/g,
  /\bvol\.?\s*\d+\b/gi,
  /vol\.?\s*\d+/gi,
  /\b\d{2,5}\s*円\b/g,
  /\d{2,5}\s*円/g,
  /\d+\s*個/g,
  /プロンプト\s*\d+\s*個?/g,
  /テンプレート\s*\d+\s*個?/g,
  /最新版|完全版|改訂版|公開版|有料版|販売中|限定販売|特典付き/g,
  /BAN確定|無修正|永久保存版|全部入り/g,
] as const;
const repeatedPhraseLimits = {
  初心者: 5,
  判断: 2,
  整理: 1,
  ポイント: 3,
  重要: 0,
  必要: 7,
  記事: 6,
  詳細: 4,
  無料: 6,
  続き: 5,
} satisfies Record<string, number>;
const duplicateThresholds = {
  sentenceSimilarity: 88,
  paragraphSimilarity: 82,
  headingSimilarity: 76,
  overallDuplication: 32,
  productNameMax: 2,
} as const;
const informationLeakPhrases = [
  "具体プロンプト",
  "テンプレート全文",
  "手順全文",
  "大量サンプル",
  "コピペ用",
  "そのまま使えるプロンプト",
];
const hashtagCandidates = [
  {
    tag: "#画像生成AI",
    keywords: ["画像", "実写", "ポートレート", "グラビア", "イラスト", "モデル"],
  },
  {
    tag: "#AI美女",
    keywords: ["美女", "清楚", "グラビア", "ポートレート"],
  },
  {
    tag: "#AIポートレート",
    keywords: ["ポートレート", "実写", "写真", "顔", "モデル"],
  },
  {
    tag: "#AIグラビア",
    keywords: ["グラビア", "美女", "写真", "モデル"],
  },
  {
    tag: "#AIイラスト",
    keywords: ["イラスト", "アニメ", "絵", "キャラ"],
  },
  {
    tag: "#AIモデル",
    keywords: ["モデル", "美女", "ポートレート", "実写"],
  },
  {
    tag: "#プロンプト",
    keywords: ["プロンプト", "呪文", "ChatGPT", "テンプレート"],
  },
  {
    tag: "#ChatGPT",
    keywords: ["ChatGPT", "GPT", "プロンプト"],
  },
  {
    tag: "#生成AI",
    keywords: ["生成AI", "AI", "画像生成", "ChatGPT"],
  },
  {
    tag: "#note",
    keywords: ["note", "記事", "無料記事"],
  },
  {
    tag: "#note収益化",
    keywords: ["note", "収益", "販売", "有料記事", "送客"],
  },
  {
    tag: "#AI副業",
    keywords: ["副業", "収益", "販売", "AI", "note"],
  },
  {
    tag: "#NSFW",
    keywords: ["NSFW", "グラビア", "美女", "成人"],
  },
] as const;
const titleCategories = [
  "初心者",
  "失敗",
  "比較",
  "チェックリスト",
  "誤解",
  "体験談",
  "理由",
  "Q&A",
  "ランキング",
  "ケーススタディ",
] as const;

type TitleCategory = (typeof titleCategories)[number];

type TitleCandidate = {
  title: string;
  category: TitleCategory;
  angleKey: string;
  ctrScore: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[【】「」『』（）()[\]{}<>〈〉《》]/g, " ")
    .replace(/[|｜:：,，.。!！?？・/／\\_-]/g, " ")
    .replace(/\b(最新版|完全版|改訂版)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  const normalized = normalizeForMatch(value);
  const numbers = normalized.match(/\d+/g) ?? [];
  const latin = normalized.match(/[a-z]+/g) ?? [];
  const japaneseChunks = normalized
    .replace(/[a-z0-9]+/g, " ")
    .split(" ")
    .flatMap((chunk) => {
      if (chunk.length <= 2) {
        return chunk ? [chunk] : [];
      }

      const tokens: string[] = [];
      for (let index = 0; index <= chunk.length - 2; index += 1) {
        tokens.push(chunk.slice(index, index + 2));
      }
      return tokens;
    });

  return [...numbers, ...latin, ...japaneseChunks];
}

function levenshteinDistance(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function calculateLevenshteinSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeForMatch(left);
  const normalizedRight = normalizeForMatch(right);
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);

  if (maxLength === 0) {
    return 100;
  }

  return clampScore((1 - levenshteinDistance(normalizedLeft, normalizedRight) / maxLength) * 100);
}

function calculateJaccardSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 100;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);

  return clampScore((intersection.length / union.size) * 100);
}

function calculateNumberTokenScore(left: string, right: string) {
  const leftNumbers = new Set(normalizeForMatch(left).match(/\d+/g) ?? []);
  const rightNumbers = new Set(normalizeForMatch(right).match(/\d+/g) ?? []);

  if (leftNumbers.size === 0 && rightNumbers.size === 0) {
    return 0;
  }

  const intersection = [...leftNumbers].filter((token) => rightNumbers.has(token));
  const union = new Set([...leftNumbers, ...rightNumbers]);
  return clampScore((intersection.length / union.size) * 100);
}

function calculateKeywordOverlapScore(left: string, right: string) {
  const stopWords = new Set(["ため", "こと", "記事", "無料", "有料", "解説"]);
  const leftTokens = new Set(tokenize(left).filter((token) => !stopWords.has(token)));
  const rightTokens = new Set(tokenize(right).filter((token) => !stopWords.has(token)));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  return clampScore((intersection.length / Math.min(leftTokens.size, rightTokens.size)) * 100);
}

function calculateSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeForMatch(left);
  const normalizedRight = normalizeForMatch(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 100;
  }

  const partialScore =
    normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
      ? 88
      : 0;
  const levenshteinScore = calculateLevenshteinSimilarity(normalizedLeft, normalizedRight);
  const jaccardScore = calculateJaccardSimilarity(normalizedLeft, normalizedRight);
  const numberScore = calculateNumberTokenScore(normalizedLeft, normalizedRight);
  const keywordScore = calculateKeywordOverlapScore(normalizedLeft, normalizedRight);

  return clampScore(
    Math.max(partialScore, levenshteinScore * 0.45 + jaccardScore * 0.35 + keywordScore * 0.2, numberScore),
  );
}

function findMaxSimilarity(value: string, targets: string[]) {
  return targets.reduce((max, target) => Math.max(max, calculateSimilarity(value, target)), 0);
}

function buildReaderProblem(intent: string, article: FreeArticleDestination) {
  return createHumanProblem(intent, article);
}

function buildTargetReader(intent: string, article: FreeArticleDestination) {
  const persona = createPersona(article);

  if (intent === "初心者向け" || intent === "用語解説") {
    return persona;
  }

  if (intent === "比較" || intent === "導入前の不安解消") {
    return `${persona}。無料情報と有料版の違いも知りたい`;
  }

  return persona;
}

function buildExpectedCta(role: string, article: FreeArticleDestination) {
  const { coreTopic } = analyzeDestinationArticle(article);

  if (role === "980円記事への送客") {
    return `${coreTopic}の具体的な手順を有料版で確認してもらう`;
  }

  if (role === "購入前教育") {
    return `無料記事で不安をほどき、必要な人だけ詳細版へ進んでもらう`;
  }

  return `続きで具体例と手順を読めると伝える`;
}

function buildTitle(intent: string, theme: string) {
  const compactTheme = createClickableTopic(summarizeArticleTheme(theme));
  const titlePatterns: Record<string, string> = {
    悩み解決: `${compactTheme}で手が止まる人が最初に見るべきこと`,
    初心者向け: `${compactTheme}で初心者が最初につまずく3つの壁`,
    比較: `${compactTheme}は無料情報だけで足りるのか`,
    失敗回避: `${compactTheme}でよくある失敗と避け方`,
    手順解説: `${compactTheme}を始める前にやる3つの準備`,
    事例: `${compactTheme}で伸びる人と止まる人の違い`,
    チェックリスト: `${compactTheme}を始める前に確認したい7項目`,
    用語解説: `${compactTheme}で最初に覚えるべき言葉`,
    トレンド: `今${compactTheme}を始める人が増えている理由`,
    導入前の不安解消: `${compactTheme}へ進む前に不安になるポイント`,
  };

  return titlePatterns[intent] ?? `${compactTheme}で最初につまずくポイント`;
}

function calculatePriority({
  duplicateScore,
  titleSimilarityScore,
  funnelRole,
  article,
}: {
  duplicateScore: number;
  titleSimilarityScore: number;
  funnelRole: string;
  article: FreeArticleDestination;
}) {
  const opportunityScore =
    article.pv >= 100 && article.conversionRate < 10
      ? 24
      : article.purchases > 0
        ? 18
        : 10;
  const funnelScore = funnelRole === "980円記事への送客" ? 24 : funnelRole === "購入前教育" ? 18 : 12;
  const uniquenessScore = Math.max(0, 35 - Math.max(duplicateScore, titleSimilarityScore) * 0.35);
  const total = opportunityScore + funnelScore + uniquenessScore;

  if (total >= 68) {
    return "高";
  }

  if (total >= 54) {
    return "中";
  }

  return "低";
}

function getReferenceKeyword(article: FreeArticleDestination) {
  const noteKeywords = normalizeForMatch(article.note)
    .split(" ")
    .filter((token) => token.length >= 2)
    .slice(0, 2)
    .join(" ");

  return noteKeywords ? summarizeArticleTheme(noteKeywords) : summarizeArticleTheme(article.title);
}

function sanitizeArticleTitleForTheme(title: string) {
  return productTitleNoisePatterns
    .reduce((value, pattern) => value.replace(pattern, " "), title.normalize("NFKC"))
    .normalize("NFKC")
    .replace(/[「」『』（）()[\]{}<>〈〉《》]/g, " ")
    .replace(/\b20\d{2}年\b/g, " ")
    .replace(/20\d{2}年/g, " ")
    .replace(/[#＃]|note|NOTE/g, " ")
    .replace(/販売|購入|特典|値下げ|セール|限定|収益化/g, " ")
    .replace(/[|｜:：,，.。!！?？/／\\_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeArticleTheme(rawValue: string) {
  const value = sanitizeArticleTitleForTheme(rawValue);
  const source = rawValue.normalize("NFKC");
  const isAiSource = /AI|画像|写真|生成|プロンプト|ChatGPT|Stable|Midjourney/i.test(
    `${source} ${value}`,
  );

  if (/盗撮/.test(`${source} ${value}`) && isAiSource) {
    return "盗撮風AI画像を自然に作る考え方";
  }

  if (/素人/.test(`${source} ${value}`) && isAiSource) {
    return "AIで素人風写真を自然に作る考え方";
  }

  if (/美女/.test(`${source} ${value}`) && isAiSource) {
    return "AI美女生成で自然さを出す考え方";
  }

  if (/グラビア/.test(`${source} ${value}`) && isAiSource) {
    return "AIグラビア画像で自然さを出す考え方";
  }

  if (/ポートレート/.test(`${source} ${value}`) && isAiSource) {
    return "AIポートレートを自然に見せる考え方";
  }

  if (/ChatGPT/i.test(value)) {
    return "ChatGPT活用で最初につまずく部分";
  }

  if (/note/.test(rawValue) && /売|稼|収益|販売/.test(rawValue)) {
    return "note販売で最初に見直したい導線";
  }

  const tokens = value
    .split(/[\s・|｜/／:：,，.。!！?？]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !genericTitleWords.includes(token))
    .filter((token) => !/^\d+$/.test(token));

  const topic = tokens.slice(0, 4).join("");

  if (topic.length >= 15) {
    return topic.slice(0, 40);
  }

  if (topic) {
    return `${topic}で最初につまずく部分`.slice(0, 40);
  }

  return "無料記事から有料版へ進む前の考え方";
}

function getCoreTopic(article: FreeArticleDestination) {
  return summarizeArticleTheme(`${article.title} ${article.note}`);
}

function analyzeDestinationArticle(article: FreeArticleDestination) {
  const coreTopic = getCoreTopic(article);
  const normalizedText = `${article.title} ${article.note}`.normalize("NFKC");
  const isAiTopic = /AI|ChatGPT|画像|動画|美女|プロンプト|Stable|Midjourney|生成/i.test(
    normalizedText,
  );
  const isBeginnerFriendly = /初心者|入門|はじめ|基礎|最初/.test(normalizedText);
  const hasExamples = /事例|例|ケース|実例/.test(normalizedText);

  return {
    coreTopic,
    isAiTopic,
    isBeginnerFriendly,
    hasExamples,
    pricePoint:
      article.price <= 980 ? "手に取りやすい価格" : "しっかり検討して買う価格",
    traction:
      article.purchases > 0
        ? "すでに買われている実績がある"
        : article.pv >= 100
          ? "見られているが購入前の不安が残っている"
          : "まだ入口の記事を増やしたい",
  };
}

function createPersona(article: FreeArticleDestination) {
  const analysis = analyzeDestinationArticle(article);

  if (analysis.isAiTopic) {
    return `${analysis.coreTopic}を始めたいが、ツール選びや最初の作り方で手が止まっている人`;
  }

  if (analysis.isBeginnerFriendly) {
    return `${analysis.coreTopic}に興味はあるが、最初の一歩で迷っている人`;
  }

  return `${analysis.coreTopic}を試したいが、自分に必要かまだ確信できていない人`;
}

function createHumanProblem(intent: string, article: FreeArticleDestination) {
  const { coreTopic, isAiTopic } = analyzeDestinationArticle(article);

  if (intent === "失敗回避") {
    return isAiTopic
      ? `${coreTopic}で何度試しても思った見た目にならず、どこを直せばいいか分からない`
      : `${coreTopic}で自己流のまま進めて、時間だけ溶けるのが怖い`;
  }

  if (intent === "比較") {
    return isAiTopic
      ? `ChatGPTだけで足りるのか、専用のやり方まで覚えるべきか迷っている`
      : `無料情報だけで足りるのか、詳しい手順まで見るべきか迷っている`;
  }

  if (intent === "初心者向け") {
    return `${coreTopic}を始めたいが、最初に何を覚えればいいか分からない`;
  }

  if (intent === "導入前の不安解消") {
    return `買ったあとに自分でも使いこなせるか不安がある`;
  }

  return `${coreTopic}に興味はあるが、いきなり有料版へ進むほど腹落ちしていない`;
}

function replaceRepeatedProductName(text: string, articleTitle: string) {
  if (!articleTitle.trim()) {
    return text;
  }

  let count = 0;
  return text.replaceAll(articleTitle, () => {
    count += 1;
    if (count <= duplicateThresholds.productNameMax) {
      return articleTitle;
    }

    return productAliases[(count - 2) % productAliases.length];
  });
}

function limitProductNameUsage(text: string, articleTitle: string) {
  if (!articleTitle.trim()) {
    return text;
  }

  let count = 0;
  return text.replaceAll(articleTitle, () => {
    count += 1;
    return count <= duplicateThresholds.productNameMax
      ? articleTitle
      : productAliases[(count - duplicateThresholds.productNameMax - 1) % productAliases.length];
  });
}

function normalizeForDuplicateCheck(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[#*`>・、。，．,.!?！？:：;；「」『』（）()[\]{}【】]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function splitSentences(text: string) {
  return text
    .replace(/^#+\s.+$/gm, "")
    .split(/(?<=[。！？!?])|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12);
}

function splitParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length >= 40)
    .filter((paragraph) => !paragraph.startsWith("# "));
}

function getNgrams(value: string, size = 3) {
  const normalized = normalizeForDuplicateCheck(value);

  if (normalized.length <= size) {
    return normalized ? [normalized] : [];
  }

  return Array.from(
    { length: normalized.length - size + 1 },
    (_, index) => normalized.slice(index, index + size),
  );
}

function calculateNgramJaccard(left: string, right: string, size = 3) {
  const leftSet = new Set(getNgrams(left, size));
  const rightSet = new Set(getNgrams(right, size));

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  const intersection = [...leftSet].filter((token) => rightSet.has(token));
  const union = new Set([...leftSet, ...rightSet]);
  return clampScore((intersection.length / union.size) * 100);
}

function calculateDuplicateSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeForDuplicateCheck(left);
  const normalizedRight = normalizeForDuplicateCheck(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 100;
  }

  const levenshteinScore = calculateLevenshteinSimilarity(normalizedLeft, normalizedRight);
  const jaccardScore = calculateNgramJaccard(normalizedLeft, normalizedRight);
  const keywordScore = calculateKeywordOverlapScore(normalizedLeft, normalizedRight);

  return clampScore(levenshteinScore * 0.38 + jaccardScore * 0.42 + keywordScore * 0.2);
}

function countSimilarPairs(
  values: string[],
  threshold: number,
  options: { ignoreSamePrefix?: boolean } = {},
) {
  let pairs = 0;

  for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
      const left = values[leftIndex];
      const right = values[rightIndex];

      if (
        options.ignoreSamePrefix &&
        left.split(":")[0] &&
        left.split(":")[0] === right.split(":")[0]
      ) {
        continue;
      }

      if (calculateDuplicateSimilarity(left, right) >= threshold) {
        pairs += 1;
      }
    }
  }

  return pairs;
}

function countProductName(text: string, articleTitle: string) {
  if (!articleTitle.trim()) {
    return 0;
  }

  return text.split(articleTitle).length - 1;
}

function countPhraseRepetitions(text: string) {
  return Object.entries(repeatedPhraseLimits).reduce((total, [phrase, limit]) => {
    const count = text.split(phrase).length - 1;
    return total + Math.max(0, count - limit);
  }, 0);
}

function countReusedExamples(text: string) {
  const exampleLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /具体例\d|NG例|比較例|改善例/.test(line));
  const normalizedExamples = exampleLines.map(normalizeForDuplicateCheck);
  const uniqueExamples = new Set(normalizedExamples);
  const exactReuses = normalizedExamples.length - uniqueExamples.size;
  const similarReuses = countSimilarPairs(
    exampleLines.map((line) => line.replace(/^[-\d.:\s]+/, "")),
    84,
  );

  return Math.max(exactReuses, similarReuses);
}

function removeDuplicateSentences(text: string) {
  const seen = new Set<string>();

  return text
    .split("\n")
    .map((line) => {
      const sentences = line
        .split(/(?<=[。！？!?])/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
      const filtered = sentences.filter((sentence) => {
        const normalized = normalizeForDuplicateCheck(sentence);

        if (normalized.length < 12) {
          return true;
        }

        if (seen.has(normalized)) {
          return false;
        }

        const similar = [...seen].some(
          (existing) => calculateDuplicateSimilarity(sentence, existing) >= 94,
        );

        if (similar) {
          return false;
        }

        seen.add(normalized);
        return true;
      });

      return filtered.join("");
    })
    .join("\n");
}

function reducePhraseOveruse(text: string) {
  return Object.entries(repeatedPhraseLimits).reduce((current, [phrase, limit]) => {
    let count = 0;
    const lines = current.split("\n").filter((line) => {
      if (!line.includes(phrase)) {
        return true;
      }

      count += 1;
      if (count <= limit) {
        return true;
      }

      const isStructuralLine = /^#|^[-\d.□]/.test(line.trim());
      return isStructuralLine;
    });

    return lines.join("\n");
  }, text);
}

function compactSimilarParagraphs(text: string) {
  const kept: string[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();

    if (trimmed.length < 40 || trimmed.startsWith("# ")) {
      kept.push(trimmed);
      continue;
    }

    const isDuplicate = kept.some(
      (existing) =>
        existing.length >= 40 &&
        !existing.startsWith("# ") &&
        calculateDuplicateSimilarity(existing, trimmed) >= 88,
    );

    if (!isDuplicate) {
      kept.push(trimmed);
    }
  }

  return kept.filter(Boolean).join("\n\n");
}

function normalizeGeneratedDraft(
  draft: GeneratedFreeArticleDraft,
  context: FreeArticleDraftContext,
) {
  const cleanedFullDraft = polishDraft(
    compactSimilarParagraphs(
      reducePhraseOveruse(
        removeDuplicateSentences(
          limitProductNameUsage(draft.fullDraft, context.destinationArticle.title),
        ),
      ),
    ),
  );

  return {
    ...draft,
    fullDraft: cleanedFullDraft,
  };
}

function getExistingHashtags(text: string) {
  return new Set(text.match(/#[\p{L}\p{N}_-]+/gu) ?? []);
}

function selectHashtags({
  idea,
  context,
  draftText,
}: {
  idea: FreeArticleIdeaForDraft;
  context: FreeArticleDraftContext;
  draftText: string;
}) {
  const sourceText = [
    idea.theme,
    idea.title,
    idea.searchIntent,
    idea.funnelRole,
    idea.readerProblem,
    context.destinationArticle.title,
    context.destinationArticle.note,
    draftText,
  ]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  const existingTags = getExistingHashtags(draftText);
  const scoredTags = hashtagCandidates
    .map((candidate, index) => {
      const score = candidate.keywords.reduce((total, keyword) => {
        const normalizedKeyword = keyword.normalize("NFKC").toLowerCase();
        return total + (sourceText.includes(normalizedKeyword) ? 1 : 0);
      }, 0);

      return {
        tag: candidate.tag,
        score,
        index,
      };
    })
    .filter((candidate) => !existingTags.has(candidate.tag))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });
  const selected = scoredTags
    .filter((candidate) => candidate.score > 0)
    .slice(0, 5)
    .map((candidate) => candidate.tag);

  if (selected.length >= 3) {
    return selected;
  }

  const fallbackTags = scoredTags.map((candidate) => candidate.tag);

  return [...new Set([...selected, ...fallbackTags])].slice(0, 5).slice(0, Math.max(3, selected.length));
}

function appendHashtagsToDraft({
  text,
  idea,
  context,
}: {
  text: string;
  idea: FreeArticleIdeaForDraft;
  context: FreeArticleDraftContext;
}) {
  const cleanedText = text.replace(/\n{3,}/g, "\n\n").trim();
  const hashtags = selectHashtags({
    idea,
    context,
    draftText: cleanedText,
  });

  return [cleanedText, hashtags.join("\n")].join("\n\n");
}

function reduceAiSmell(text: string) {
  const replacements: Record<string, string> = {
    この記事では: "ここでは",
    解説します: "話します",
    ご紹介します: "まとめます",
    重要です: "かなり効きます",
    大切です: "あとで差が出ます",
    まとめると: "最後にもう一度だけ言うと",
    ぜひ参考にしてください: "必要なところだけ持ち帰ってください",
    活用しましょう: "使ってみてください",
    理解できます: "見えてきます",
  };
  const targetReaderPlaceholder = "__TARGET_READER_LABEL__";

  return Object.entries(replacements)
    .reduce(
      (current, [from, to]) => current.replaceAll(from, to),
      text.replaceAll("対象読者", targetReaderPlaceholder),
    )
    .replace(/読者/g, "読み手")
    .replaceAll(targetReaderPlaceholder, "対象読者")
    .replace(/判断基準/g, "見るポイント")
    .replace(/整理/g, "分けて考え")
    .replace(/範囲/g, "ここまで")
    .replace(/かなり大事です/g, "かなり効きます");
}

function mapCategoryToIntent(category?: string) {
  const mapping: Record<string, string> = {
    認知: "悩み解決",
    初心者向け: "初心者向け",
    比較: "比較",
    失敗例: "失敗回避",
    チェックリスト: "チェックリスト",
    FAQ: "導入前の不安解消",
    用語解説: "用語解説",
    事例: "事例",
    レビュー: "比較",
    トレンド: "トレンド",
    注意点: "失敗回避",
    購入前教育: "導入前の不安解消",
    CTA記事: "手順解説",
  };

  return category ? mapping[category] : undefined;
}

function mapCategoryToFunnelRole(category?: string) {
  const mapping: Record<string, string> = {
    認知: "認知",
    初心者向け: "認知",
    比較: "比較検討",
    失敗例: "購入前教育",
    チェックリスト: "購入前教育",
    FAQ: "購入前教育",
    用語解説: "興味",
    事例: "比較検討",
    レビュー: "比較検討",
    トレンド: "認知",
    注意点: "購入前教育",
    購入前教育: "購入前教育",
    CTA記事: "980円記事への送客",
  };

  return category ? mapping[category] : undefined;
}

function buildBaseIdeas(article: FreeArticleDestination, focusCategory?: string) {
  const referenceKeyword = getReferenceKeyword(article);
  const articleTheme = getCoreTopic(article);
  const focusIntent = mapCategoryToIntent(focusCategory);
  const focusFunnelRole = mapCategoryToFunnelRole(focusCategory);

  return Array.from({ length: 20 }, (_, index) => {
    const shouldPrioritizeFocus = Boolean(focusCategory) && index < 5;
    const searchIntent =
      shouldPrioritizeFocus && focusIntent
        ? focusIntent
        : searchIntents[index % searchIntents.length];
    const funnelRole =
      shouldPrioritizeFocus && focusFunnelRole
        ? focusFunnelRole
        : funnelRoles[index % funnelRoles.length];
    const angle = angleTemplates[index];
    const categoryPrefix = shouldPrioritizeFocus ? `${focusCategory}から考える` : "";
    const theme =
      funnelRole === "980円記事への送客"
        ? `${categoryPrefix}${referenceKeyword}から${articleTheme}へ進む前の判断軸`
        : `${categoryPrefix}${referenceKeyword}の${angle}`;

    return {
      theme,
      title: buildTitle(searchIntent, theme),
      searchIntent,
      targetReader: buildTargetReader(searchIntent, article),
      readerProblem: buildReaderProblem(searchIntent, article),
      angle,
      funnelRole,
      expectedCta: buildExpectedCta(funnelRole, article),
    };
  });
}

function buildHumanTitleIdeas(
  idea: FreeArticleIdeaForDraft,
  context: FreeArticleDraftContext,
) {
  return generateTitleCandidates(idea, context).map((candidate) => candidate.title);
}

function generateTitleCandidates(
  idea: FreeArticleIdeaForDraft,
  context: FreeArticleDraftContext,
) {
  const analysis = analyzeDestinationArticle(context.destinationArticle);
  const topic = createClickableTopic(analysis.coreTopic);
  const problem = idea.readerProblem
    .replace(analysis.coreTopic, "")
    .replace(/[。、]/g, "")
    .trim();
  const rawCandidates = titleCategories.flatMap((category) =>
    buildTitleTemplatesByCategory(category, topic, problem || topic),
  );
  const uniqueCandidates = removeSameAngleTitles(rawCandidates);

  return uniqueCandidates
    .map((candidate) => ({
      ...candidate,
      ctrScore: calculateTitleCtrScore(candidate, context.destinationArticle),
    }))
    .sort((left, right) => {
      if (right.ctrScore !== left.ctrScore) {
        return right.ctrScore - left.ctrScore;
      }

      return titleCategories.indexOf(left.category) - titleCategories.indexOf(right.category);
    })
    .slice(0, 10);
}

function buildTitleTemplatesByCategory(
  category: TitleCategory,
  topic: string,
  problem: string,
): TitleCandidate[] {
  const templates: Record<TitleCategory, Array<{ title: string; angleKey: string }>> = {
    初心者: [
      { title: `${topic}初心者が最初に見直す3つのこと`, angleKey: "beginner-first-3" },
      { title: `${topic}を始めた人が最初につまずく壁`, angleKey: "beginner-wall" },
      { title: `${topic}で最初に覚えるべきこと`, angleKey: "beginner-first-learn" },
    ],
    失敗: [
      { title: `${topic}で遠回りする人の共通点`, angleKey: "failure-detour" },
      { title: `${topic}が上達しない人がやりがちな失敗`, angleKey: "failure-not-improve" },
      { title: `${topic}で何度やっても崩れる理由`, angleKey: "failure-breaks" },
    ],
    比較: [
      { title: `${topic}は無料情報だけでどこまでいけるのか`, angleKey: "compare-free-paid" },
      { title: `${topic}で伸びる人と止まる人の違い`, angleKey: "compare-grow-stop" },
      { title: `${topic}で独学する人と最短で進む人の差`, angleKey: "compare-self-shortcut" },
    ],
    チェックリスト: [
      { title: `${topic}で詰まった時のチェックリスト`, angleKey: "check-stuck" },
      { title: `${topic}を始める前に確認したい7項目`, angleKey: "check-before-7" },
      { title: `${topic}がうまくいかない時に見るリスト`, angleKey: "check-not-working" },
    ],
    誤解: [
      { title: `${topic}で初心者が勘違いしやすいこと`, angleKey: "misunderstand-beginner" },
      { title: `${topic}は才能がないと無理だと思っている人へ`, angleKey: "misunderstand-talent" },
      { title: `${topic}で最初に捨てたい思い込み`, angleKey: "misunderstand-assumption" },
    ],
    体験談: [
      { title: `私が${topic}で最初に失敗したこと`, angleKey: "story-first-fail" },
      { title: `${topic}で手が止まった時に変えたこと`, angleKey: "story-changed" },
      { title: `${topic}を始めた頃に知りたかった話`, angleKey: "story-wish-knew" },
    ],
    理由: [
      { title: `${topic}がなかなか思い通りにならない理由`, angleKey: "reason-not-as-wanted" },
      { title: `${topic}で成果が出る人が先に見ているもの`, angleKey: "reason-what-winners-see" },
      { title: `${problem}が起きる本当の理由`, angleKey: "reason-problem-root" },
    ],
    "Q&A": [
      { title: `${topic}は何から始めればいい？`, angleKey: "qa-where-start" },
      { title: `${topic}で無料情報だけだと足りない？`, angleKey: "qa-free-enough" },
      { title: `${topic}がうまくいかない時は何を見る？`, angleKey: "qa-what-check" },
    ],
    ランキング: [
      { title: `${topic}で最初に直すべきポイントTOP5`, angleKey: "ranking-fix-top5" },
      { title: `${topic}初心者がつまずく原因ランキング`, angleKey: "ranking-beginner-stuck" },
      { title: `${topic}で効果が出やすい見直し順`, angleKey: "ranking-review-order" },
    ],
    ケーススタディ: [
      { title: `${topic}で止まる人のよくあるケース`, angleKey: "case-stuck" },
      { title: `${topic}が伸びる人の小さな共通点`, angleKey: "case-grow" },
      { title: `${topic}で失敗から抜けた人の考え方`, angleKey: "case-recovery" },
    ],
  };

  return templates[category].map((template) => ({
    title: cleanTitle(template.title),
    category,
    angleKey: template.angleKey,
    ctrScore: 0,
  }));
}

function removeSameAngleTitles(candidates: TitleCandidate[]) {
  const seenAngleKeys = new Set<string>();
  const seenNormalizedTitles = new Set<string>();

  return candidates.filter((candidate) => {
    const normalizedTitle = normalizeForMatch(candidate.title);
    const duplicate =
      seenAngleKeys.has(candidate.angleKey) ||
      [...seenNormalizedTitles].some((title) => calculateSimilarity(candidate.title, title) >= 86);

    if (duplicate) {
      return false;
    }

    seenAngleKeys.add(candidate.angleKey);
    seenNormalizedTitles.add(normalizedTitle);
    return true;
  });
}

function calculateTitleCtrScore(candidate: TitleCandidate, article: FreeArticleDestination) {
  const clickWords = [
    "3つ",
    "5",
    "7",
    "TOP",
    "理由",
    "失敗",
    "違い",
    "共通点",
    "チェックリスト",
    "何から",
    "なぜ",
    "私が",
  ];
  const categoryScores: Record<TitleCategory, number> = {
    初心者: 12,
    失敗: 15,
    比較: 13,
    チェックリスト: 14,
    誤解: 13,
    体験談: 12,
    理由: 15,
    "Q&A": 12,
    ランキング: 14,
    ケーススタディ: 11,
  };
  const titleLength = candidate.title.length;
  const lengthScore = titleLength >= 16 && titleLength <= 30 ? 16 : titleLength <= 34 ? 10 : 4;
  const clickScore = clickWords.reduce(
    (total, word) => total + (candidate.title.includes(word) ? 5 : 0),
    0,
  );
  const articleSimilarityPenalty = calculateSimilarity(candidate.title, article.title) >= 80 ? 18 : 0;
  const genericPenalty = /完全版|最新版|解説|紹介|まとめ/.test(candidate.title) ? 10 : 0;

  return clampScore(
    45 + categoryScores[candidate.category] + lengthScore + clickScore - articleSimilarityPenalty - genericPenalty,
  );
}

function createClickableTopic(coreTopic: string) {
  const source = sanitizeArticleTitleForTheme(coreTopic);

  if (/盗撮/.test(source) && /AI|画像|写真|生成/i.test(source)) {
    return "盗撮風AI画像";
  }

  if (/素人/.test(source) && /AI|画像|写真|生成/i.test(source)) {
    return "AIで素人風写真";
  }

  if (/美女/.test(source) && /AI|画像|動画|生成/i.test(source)) {
    return "AI美女生成";
  }

  if (/動画/.test(source) && /AI|生成/i.test(source)) {
    return "AI動画";
  }

  if (/ChatGPT/i.test(source)) {
    return "ChatGPT";
  }

  if (/note/.test(source) && /売|稼|収益/.test(source)) {
    return "note販売";
  }

  return coreTopic
    .replace(/【[^】]*】/g, "")
    .replace(/Vol\.?\d+/gi, "")
    .replace(/\d+個/g, "")
    .replace(/プロンプト複数配布中/g, "")
    .replace(/完全設計/g, "")
    .replace(/\s+/g, "")
    .slice(0, 14);
}

function cleanTitle(title: string) {
  return title
    .replace(/[【】「」『』]/g, "")
    .replace(/\s+/g, "")
    .replace(/ことこと/g, "こと")
    .replace(/でで/g, "で")
    .slice(0, 34);
}

function selectBestTitle(
  titleIdeas: string[],
  article: FreeArticleDestination,
  idea: FreeArticleIdeaForDraft,
  attemptIndex: number,
) {
  const articleSimilarityPenalty = (title: string) =>
    calculateSimilarity(title, article.title) >= 80 ? 22 : 0;
  const clickWords = ["3つ", "理由", "失敗", "違い", "初心者", "共通点", "チェックリスト"];
  const intentBoostWords: Record<string, string[]> = {
    悩み解決: ["理由", "見直す", "つまずく"],
    初心者向け: ["初心者", "最初", "始め"],
    比較: ["違い", "無料", "差"],
    失敗回避: ["失敗", "遠回り", "崩れる"],
    手順解説: ["チェックリスト", "順", "何から"],
    事例: ["ケース", "共通点", "私が"],
    チェックリスト: ["チェックリスト", "確認", "項目"],
    用語解説: ["何から", "覚える", "最初"],
    トレンド: ["理由", "増えて", "今"],
    導入前の不安解消: ["足りない", "無料", "不安"],
  };
  const ideaSimilarityBonus = (title: string) =>
    calculateSimilarity(title, idea.title) >= 58 ? 10 : 0;
  const intentBonus = (title: string) =>
    (intentBoostWords[idea.searchIntent] ?? []).reduce(
      (total, word) => total + (title.includes(word) ? 9 : 0),
      0,
    );
  const preferredWords = intentBoostWords[idea.searchIntent] ?? [];
  const directIntentMatches = titleIdeas.filter((title) =>
    preferredWords.some((word) => title.includes(word)),
  );

  if (directIntentMatches.length > 0) {
    return directIntentMatches[Math.min(attemptIndex, directIntentMatches.length - 1)];
  }

  const ranked = [...titleIdeas].sort((left, right) => {
    const score = (title: string) =>
      clickWords.reduce((total, word) => total + (title.includes(word) ? 6 : 0), 0) +
      ideaSimilarityBonus(title) +
      intentBonus(title) -
      articleSimilarityPenalty(title) -
      Math.max(0, title.length - 30) * 1.2;

    return score(right) - score(left);
  });

  return ranked[Math.min(attemptIndex, ranked.length - 1)];
}

function buildIntroduction(context: FreeArticleDraftContext) {
  const analysis = analyzeDestinationArticle(context.destinationArticle);
  const topic = createClickableTopic(analysis.coreTopic);

  return reduceAiSmell(
    `${topic}を始めると、最初は「何が悪いのか分からない」のがいちばん苦しいです。\n\n私も最初は、うまい人の真似をしているつもりなのに、なぜか同じようにならなくてかなり悩みました。\n\nでも、ここで止まるのは普通です。才能がないからではありません。\n\nこの無料記事では、失敗しやすい場所と、どこを見れば迷いが減るのかまでを話します。具体的な作り込みやテンプレートは出しません。そこまで必要かどうかを、自分で判断できる状態まで持っていきます。`,
  );
}

function buildHeadings(context: FreeArticleDraftContext) {
  const analysis = analyzeDestinationArticle(context.destinationArticle);
  const topic = createClickableTopic(analysis.coreTopic);

  return [
    `1. 共感：${topic}で止まる人はかなり多いです`,
    `2. 失敗：最初にやりがちなズレ`,
    `3. 原因：うまくいかない理由はここにあります`,
    `4. 解決策：まず見る場所を変える`,
    `5. まだ足りない理由：考え方だけでは再現しきれない`,
    `6. 続きが必要な人：ここから先で差が出ます`,
  ];
}

function buildBody({
  context,
  headings,
  attemptIndex,
}: {
  context: FreeArticleDraftContext;
  headings: string[];
  attemptIndex: number;
}) {
  const analysis = analyzeDestinationArticle(context.destinationArticle);
  const topic = createClickableTopic(analysis.coreTopic);
  const examples = buildConcreteExamples(topic, analysis.isAiTopic, attemptIndex);
  const practicalFrame = buildTodayAction(topic, analysis.isAiTopic, attemptIndex);

  const paragraphs = [
    `${headings[0]}\n\n${topic}で手が止まると、「自分には向いていないのかも」と思いやすいです。\n\nでも、多くの人はここで止まります。最初からきれいに進められる人の方が少ないです。\n\nたとえば、こんな感じです。\n\n「何度やっても同じところで崩れる」\n「うまい人の真似をしているのに近づかない」\n「どこを直せばいいか分からない」\n\nまずは安心して大丈夫です。止まっている場所が見えれば、次に見るものも変わります。\n\nでは、最初に何を間違えやすいのでしょうか。`,
    `${headings[1]}\n\n最初の失敗は、完成形だけを真似してしまうことです。\n\n完成形はきれいに見えます。でも、途中で何を削ったのか、どこを見直したのかまでは見えません。\n\nNG例: ${examples[0]}\n\n比較すると分かりやすいです。\n\nA: 完成した結果だけを見る\nB: 途中で何を直したかを見る\n\nこの差が、あとで大きく出ます。\n\nでは、なぜ完成形だけを見ると遠回りになるのでしょうか。`,
    `${headings[2]}\n\n原因は、情報が少ないことではありません。\n\nむしろ、情報が多すぎて「何が効いているのか」を見失うことです。\n\n実際によくある例ですが、無料で見つけた情報を毎回つぎはぎして、結果が安定しない人はかなり多いです。\n\n原因を分けるなら、この3つです。\n\n- 見る場所が毎回変わる\n- 失敗の理由を記録していない\n- 直す順番が決まっていない\n\n一言で言うと、試行錯誤ではなく当たり待ちになっている状態です。\n\nでは、無料の範囲でどこまで直せるのでしょうか。`,
    `${headings[3]}\n\n無料記事でできるのは、「見る場所を決める」ところまでです。\n\nここを押さえるだけでも、迷いはかなり減ります。\n\n改善例: ${examples[1]}\n\nチェックリスト:\n□ 何が崩れているかを1つに絞れている\n□ 足す前に、削る場所を見ている\n□ うまくいった理由を言葉にできる\n□ 失敗をセンス不足だけで片づけていない\n\n${practicalFrame}\n\nここまでは無料でも理解できます。ただし、ここから先で別の壁が出ます。`,
    `${headings[4]}\n\n考え方が分かっても、実際に安定させるにはもう一段必要です。\n\nなぜなら、現実の作業では「どの順番で見るか」「どこまで直すか」「失敗した時に何を疑うか」が毎回変わるからです。\n\n無料で分かること:\n- どこで止まっているか\n- よくある失敗\n- 見る場所の方向性\n\n続きで必要になること:\n- 具体例ごとの見方\n- 失敗した時の切り分け\n- 自分の作業へ落とし込む流れ\n\nここで全部を出すと、逆に情報量が多すぎて迷います。\n\nでは、どんな人だけが続きへ進むべきなのでしょうか。`,
    `${headings[5]}\n\n続きが必要なのは、考え方だけではなく、自分の作業に落とし込みたい人です。\n\n逆に、まだ全体像を見たいだけなら、ここで十分です。\n\n続きが向いている人:\n- 失敗した時の直し方まで知りたい\n- 具体例を見ながら確認したい\n- 自分の作業に置き換えて進めたい\n\n読まなくていい人:\n- まだ試す予定がない\n- 入口だけ分かれば十分\n- 細かい例は今いらない\n\n一言まとめ: 無料記事は地図、有料版は実際に歩く時の案内です。${context.memo ? `\n\n補足として、今回は「${context.memo}」も意識しています。` : ""}`,
  ];

  return reduceAiSmell(paragraphs.join("\n\n"));
}

function buildConcreteExamples(topic: string, isAiTopic: boolean, attemptIndex: number) {
  if (isAiTopic) {
    const examples = [
      [
        `${topic}で顔だけはきれいなのに、手や背景が崩れることがあります。この時に言葉を足し続けると、原因が余計に見えにくくなります。`,
        `${topic}で雰囲気は近いのに、写真っぽさが出ないことがあります。見る場所を「顔」だけに寄せすぎると、全体の違和感を見落としやすいです。`,
        `${topic}で1枚だけ成功しても、次に同じ雰囲気が出ないことがあります。これは才能の問題ではなく、成功した条件を言葉にできていないだけのことが多いです。`,
      ],
      [
        `${topic}で「かわいい」は出るのに「自然な写真」にならない時は、顔以外の違和感を見ていないことがあります。まず何が不自然かを1つに絞るだけで、迷いは減ります。`,
        `何度も同じ方向で試しているのに崩れる時は、結果だけでなく、崩れた場所を分けて見る必要があります。髪、目線、背景、手元を同時に直そうとすると原因がぼやけます。`,
        `無料で拾った言葉を足し続けると、逆に不自然になることがあります。足す前に、余計な要素が混ざっていないかを見る方が効く場面もあります。`,
      ],
      [
        `${topic}で違和感が出る時、原因は言葉不足ではなく、作りたい写真の方向性が曖昧なことがあります。先に方向性を決めるだけで迷いが減ります。`,
        `リアル寄りにしたいのに別の雰囲気へ寄る場合、言葉だけで直そうとすると沼りやすいです。どこを疑うかの順番が必要になります。`,
        `うまくいった結果を保存するだけでは再現しにくいです。なぜ良かったのかを短く残すと、次に見る場所がはっきりします。`,
      ],
    ];

    return examples[attemptIndex] ?? examples[0];
  }

  return [
    `${topic}を始める時、最初から細かいノウハウを全部追うと、結局どこを見ればいいのか分からなくなります。`,
    `成功例だけを見ると簡単そうに見えますが、途中で詰まった時に何を疑うかが見えていないと止まりやすいです。`,
    `無料情報を読み続けているのに進まない時は、情報不足ではなく、次に見る場所が決まっていないだけのことがあります。`,
  ];
}

function buildTodayAction(topic: string, isAiTopic: boolean, attemptIndex: number) {
  if (isAiTopic) {
    const actions = [
      `${topic}なら、次に見る場所を1つだけ決めてください。全部を直そうとすると、何が効いたか分からなくなります。`,
      `${topic}なら、まず結果を「崩れている場所」と「悪くない場所」に分けてください。ここまでなら無料の範囲でも十分できます。`,
      `${topic}なら、成功した時に何が良かったのかを1行だけ残してください。細かい再現方法は、その後で考えれば大丈夫です。`,
    ];

    return actions[attemptIndex] ?? actions[0];
  }

  return `${topic}なら、次の1回は「何を変えるか」を1つだけ決めてください。全部を直そうとすると、何が効いたか分からなくなります。`;
}

function buildSummary(idea: FreeArticleIdeaForDraft, context: FreeArticleDraftContext) {
  const analysis = analyzeDestinationArticle(context.destinationArticle);
  const topic = createClickableTopic(analysis.coreTopic);

  return reduceAiSmell(
    `一言で言うと、${topic}で最初に見るべきなのは、派手な裏技ではありません。\n\n${idea.readerProblem}なら、まずは「どこで止まっているのか」を1つに絞ること。\n\nここまで分かれば、入口としては十分です。あとは、具体例を見ながら自分の作業へ落とし込むかどうかだけです。`,
  );
}

function buildDraftCandidate(
  idea: FreeArticleIdeaForDraft,
  context: FreeArticleDraftContext,
  attemptIndex: number,
): GeneratedFreeArticleDraft {
  const titleIdeas = buildHumanTitleIdeas(idea, context);
  const title = selectBestTitle(
    titleIdeas,
    context.destinationArticle,
    idea,
    attemptIndex,
  );
  const headings = buildHeadings(context);
  const purpose = `無料記事だけでも役立つ入口を作り、必要な人だけ有料版へ案内する`;
  const introduction = buildIntroduction(context);
  const body = buildBody({
    context,
    headings,
    attemptIndex,
  });
  const summary = buildSummary(idea, context);
  const cta = buildCta(context);
  const outline = headings.map((heading, index) => `${index + 1}. ${heading}`).join("\n");
  const fullDraft = appendHashtagsToDraft(
    {
      text: polishDraft(
        replaceRepeatedProductName(
          [introduction, body, summary, cta].join("\n\n"),
          context.destinationArticle.title,
        ),
      ),
      idea,
      context,
    },
  );

  return {
    titleIdeas,
    title,
    theme: idea.theme,
    targetReader: idea.targetReader,
    readerProblem: idea.readerProblem,
    purpose,
    outline,
    body: polishDraft(body),
    introduction: polishDraft(introduction),
    headings,
    summary: polishDraft(summary),
    cta: polishDraft(cta),
    fullDraft,
  };
}

function polishDraft(text: string) {
  return reduceAiSmell(text)
    .replace(/この記事では/g, "ここでは")
    .replace(/商品名/g, "有料版")
    .replace(/判断基準/g, "見るポイント")
    .replace(/重要/g, "効く")
    .replace(/大切/g, "あとで差が出る")
    .replace(/まとめると/g, "最後にもう一度だけ言うと")
    .replace(/ぜひ参考にしてください/g, "必要なところだけ持ち帰ってください")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countOccurrences(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

export function analyzeFreeArticleDuplication(
  draft: Pick<GeneratedFreeArticleDraft, "fullDraft" | "headings">,
  articleTitle: string,
): FreeArticleDuplicationMetrics {
  const text = draft.fullDraft;
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);
  const normalizedSentences = sentences.map(normalizeForDuplicateCheck);
  const exactDuplicateSentences =
    normalizedSentences.length - new Set(normalizedSentences).size;
  const similarSentencePairs = countSimilarPairs(
    sentences,
    duplicateThresholds.sentenceSimilarity,
  );
  const similarParagraphPairs = countSimilarPairs(
    paragraphs,
    duplicateThresholds.paragraphSimilarity,
  );
  const headingClaimDuplicatePairs = countSimilarPairs(
    draft.headings,
    duplicateThresholds.headingSimilarity,
    { ignoreSamePrefix: true },
  );
  const phraseRepetitionScore = clampScore(countPhraseRepetitions(text) * 8);
  const productNameCount = countProductName(text, articleTitle);
  const reusedExampleCount = countReusedExamples(text);
  const bannedPhraseCount = bannedAiPhrases.reduce(
    (total, phrase) => total + (text.includes(phrase) ? 1 : 0),
    0,
  );
  const productPenalty = Math.max(
    0,
    productNameCount - duplicateThresholds.productNameMax,
  );
  const overallDuplicationScore = clampScore(
    exactDuplicateSentences * 18 +
      similarSentencePairs * 8 +
      similarParagraphPairs * 18 +
      headingClaimDuplicatePairs * 10 +
      phraseRepetitionScore * 0.45 +
      productPenalty * 12 +
      reusedExampleCount * 14,
  );
  const qualityScore = clampScore(
    100 -
      overallDuplicationScore -
      bannedPhraseCount * 5 -
      Math.max(0, productNameCount - duplicateThresholds.productNameMax) * 8,
  );

  return {
    exactDuplicateSentences,
    similarSentencePairs,
    similarParagraphPairs,
    headingClaimDuplicatePairs,
    phraseRepetitionScore,
    productNameCount,
    reusedExampleCount,
    bannedPhraseCount,
    overallDuplicationScore,
    qualityScore,
  };
}

export function analyzeFreeArticleConversionQuality(
  draft: GeneratedFreeArticleDraft,
  context: FreeArticleDraftContext,
): FreeArticleConversionQualityMetrics {
  const text = draft.fullDraft;
  const cta = draft.cta;
  const sentenceCount = splitSentences(text).length;
  const shortSentenceCount = splitSentences(text).filter(
    (sentence) => sentence.length <= 42,
  ).length;
  const curiosityBridgeCount = countOccurrences(
    text,
    /では|なぜ|ここから|次に|どんな人|しょうか/g,
  );
  const hasPsychologicalFlow =
    text.includes("失敗") &&
    text.includes("原因") &&
    text.includes("ここまでは無料") &&
    text.includes("続きが必要");
  const hasComparison = text.includes("A:") && text.includes("B:");
  const hasChecklist = text.includes("□");
  const hasBoundary =
    text.includes("具体的な作り込み") ||
    text.includes("テンプレートは出しません") ||
    text.includes("ここまでなら無料");
  const informationLeakCount = informationLeakPhrases.reduce(
    (total, phrase) => total + (text.includes(phrase) ? 1 : 0),
    0,
  );
  const ctaRequiredParts = [
    "この続きで分かること",
    "対象読者",
    "読まなくていい人",
    "得られる成果",
    FREE_ARTICLE_CTA_URL,
  ];
  const ctaMissingCount = ctaRequiredParts.filter((part) => !cta.includes(part)).length;
  const bannedCount = bannedAiPhrases.reduce(
    (total, phrase) => total + (text.includes(phrase) ? 1 : 0),
    0,
  );
  const productNameCount = countProductName(text, context.destinationArticle.title);
  const readThroughScore = clampScore(
    78 +
      Math.min(curiosityBridgeCount, 6) * 3 +
      (shortSentenceCount / Math.max(sentenceCount, 1)) * 12 +
      (hasChecklist ? 4 : 0) +
      (hasComparison ? 4 : 0),
  );
  const referralScore = clampScore(
    76 +
      (text.includes("まだ足りない理由") ? 5 : 0) +
      (text.includes("続きが向いている人") || text.includes("続きが必要") ? 6 : 0) +
      (text.includes("ここで全部を出すと") ? 5 : 0) -
      Math.max(0, productNameCount - duplicateThresholds.productNameMax) * 8,
  );
  const empathyScore = clampScore(
    82 +
      (text.includes("私も最初は") ? 8 : 0) +
      (text.includes("多くの人") ? 5 : 0) +
      (text.includes("安心して大丈夫") ? 5 : 0),
  );
  const specificityScore = clampScore(
    78 +
      (hasComparison ? 5 : 0) +
      (hasChecklist ? 5 : 0) +
      (countOccurrences(text, /NG例|改善例|たとえば/g) >= 2 ? 6 : 0),
  );
  const tempoScore = clampScore(
    80 +
      Math.min(shortSentenceCount, 18) * 0.8 +
      (countOccurrences(text, /\n- /g) >= 8 ? 4 : 0) -
      Math.max(0, countOccurrences(text, /。/g) - 90) * 0.2,
  );
  const ctaScore = clampScore(100 - ctaMissingCount * 12);
  const aiSmellScore = clampScore(100 - bannedCount * 9);
  const informationBoundaryScore = clampScore(
    92 + (hasBoundary ? 8 : 0) - informationLeakCount * 16 - (hasPsychologicalFlow ? 0 : 8),
  );
  const overallQualityScore = Math.min(
    readThroughScore,
    referralScore,
    empathyScore,
    specificityScore,
    tempoScore,
    ctaScore,
    aiSmellScore,
    informationBoundaryScore,
  );

  return {
    readThroughScore,
    referralScore,
    empathyScore,
    specificityScore,
    tempoScore,
    ctaScore,
    aiSmellScore,
    informationBoundaryScore,
    overallQualityScore,
  };
}

function reviewDraft(
  draft: GeneratedFreeArticleDraft,
  context: FreeArticleDraftContext,
) {
  const text = draft.fullDraft;
  const duplication = analyzeFreeArticleDuplication(
    draft,
    context.destinationArticle.title,
  );
  const conversion = analyzeFreeArticleConversionQuality(draft, context);
  const bannedCount = bannedAiPhrases.reduce(
    (total, phrase) => total + (text.includes(phrase) ? 1 : 0),
    0,
  );
  const concreteExampleCount = countOccurrences(text, /具体例\d/g);
  const sectionCount = draft.headings.length;
  const hasChecklist = text.includes("□");
  const hasComparison = text.includes("A:") && text.includes("B:");
  const hasStory =
    text.includes("私も最初は") ||
    text.includes("多くの人はここで止まります") ||
    text.includes("実際によくある例ですが");
  const hasConversation = text.includes("「") && text.includes("」");
  const openingScore = clampScore(
    94 -
      (draft.introduction.includes("私も最初は") ? 0 : 10) -
      (draft.introduction.includes("途中で売り込みはしません") ? 0 : 6),
  );
  const tempoScore = clampScore(
    90 +
      (hasConversation ? 4 : 0) +
      (hasChecklist ? 3 : 0) -
      (sectionCount < 7 ? 12 : 0) -
      (countOccurrences(text, /\n- /g) > 12 ? 8 : 0),
  );
  const storyScore = clampScore(82 + (hasStory ? 14 : 0) + (hasConversation ? 4 : 0));
  const concreteScore = clampScore(
    72 + Math.min(concreteExampleCount, 3) * 7 + (hasChecklist ? 4 : 0) + (hasComparison ? 3 : 0),
  );
  const readabilityScore = clampScore(
    92 - Math.max(0, countOccurrences(text, /。/g) - 95) * 0.2 - bannedCount * 8,
  );
  const ctaScore = clampScore(
    90 -
      (draft.cta.includes("向け") ? 0 : 8) -
      (draft.cta.includes("読まなくて大丈夫") ||
      draft.cta.includes("読まなくても") ||
      draft.cta.includes("閉じても大丈夫")
        ? 0
        : 8),
  );
  const scores = {
    opening: openingScore,
    tempo: tempoScore,
    story: storyScore,
    concreteExamples: concreteScore,
    readability: readabilityScore,
    cta: ctaScore,
    duplication: duplication.qualityScore,
    readThrough: conversion.readThroughScore,
    referral: conversion.referralScore,
    empathy: conversion.empathyScore,
    specificity: conversion.specificityScore,
    aiSmell: conversion.aiSmellScore,
    informationBoundary: conversion.informationBoundaryScore,
  };

  return {
    scores,
    completionScore: Math.min(...Object.values(scores)),
    duplication,
    conversion,
  };
}

export const templateFreeArticleGenerator: FreeArticleGenerator = {
  generateIdeas(article, history, focusCategory) {
    const baseIdeas = buildBaseIdeas(article, focusCategory);
    const historicalThemes = [...history.draftThemes, ...history.articleTitles];
    const historicalTitles = [...history.draftTitles, ...history.articleTitles];

    return baseIdeas.map((idea, index) => {
      const siblingThemes = baseIdeas
        .filter((_, siblingIndex) => siblingIndex !== index)
        .map((sibling) => sibling.theme);
      const siblingTitles = baseIdeas
        .filter((_, siblingIndex) => siblingIndex !== index)
        .map((sibling) => sibling.title);
      const duplicateScore = Math.max(
        findMaxSimilarity(idea.theme, historicalThemes),
        findMaxSimilarity(idea.theme, siblingThemes),
      );
      const titleSimilarityScore = Math.max(
        findMaxSimilarity(idea.title, historicalTitles),
        findMaxSimilarity(idea.title, siblingTitles),
      );

      return {
        ...idea,
        duplicateScore,
        titleSimilarityScore,
        priority: calculatePriority({
          duplicateScore,
          titleSimilarityScore,
          funnelRole: idea.funnelRole,
          article,
        }),
      };
    });
  },

  generateDraft(idea, context) {
    const candidates = Array.from({ length: 3 }, (_, attemptIndex) => {
      const draft = normalizeGeneratedDraft(
        buildDraftCandidate(idea, context, attemptIndex),
        context,
      );
      return {
        draft,
        review: reviewDraft(draft, context),
      };
    });
    const passingCandidate = candidates.find(
      (candidate) =>
        candidate.review.completionScore >= 90 &&
        candidate.review.duplication.overallDuplicationScore <=
          duplicateThresholds.overallDuplication &&
        candidate.review.duplication.productNameCount <=
          duplicateThresholds.productNameMax &&
        candidate.review.duplication.exactDuplicateSentences === 0 &&
        candidate.review.duplication.similarParagraphPairs === 0 &&
        candidate.review.duplication.reusedExampleCount === 0 &&
        candidate.review.conversion.overallQualityScore >= 90,
    );

    return (
      passingCandidate ??
      candidates.sort((left, right) => {
        if (right.review.completionScore !== left.review.completionScore) {
          return right.review.completionScore - left.review.completionScore;
        }

        return (
          left.review.duplication.overallDuplicationScore -
          right.review.duplication.overallDuplicationScore
        );
      })[0]
    ).draft;
  },
};

function buildCta({
  destinationArticle,
  ctaStrength,
}: Pick<FreeArticleDraftContext, "destinationArticle" | "ctaStrength">) {
  const { coreTopic } = analyzeDestinationArticle(destinationArticle);
  const topic = createClickableTopic(coreTopic);
  const notFor =
    ctaStrength === "strong"
      ? "入口だけ分かれば十分な人は、ここで閉じても大丈夫です。"
      : "今すぐ具体例まで必要ない人は、読まなくても大丈夫です。";
  const expectedOutcome =
    ctaStrength === "soft"
      ? "自分がどこで止まっているのかを見分けやすくなります。"
      : "失敗した時に、次にどこを疑えばいいかが見えやすくなります。";

  if (ctaStrength === "strong") {
    return `最後に、必要な人だけどうぞ。\n\nこの続きで分かること:\n- ${topic}でつまずいた時の見方\n- 具体例ごとの違い\n- 失敗した時に疑う順番\n- 自分の作業へ落とし込む流れ\n\n対象読者:\n${topic}をなんとなく知るだけでなく、自分でも安定させたい人向けです。\n\n読まなくていい人:\n${notFor}\n\n得られる成果:\n${expectedOutcome}\n\n${destinationArticle.title}\n${FREE_ARTICLE_CTA_URL}`;
  }

  if (ctaStrength === "soft") {
    return `最後に、必要な人だけ置いておきます。\n\nこの続きで分かること:\n- ${topic}で迷いやすい場面\n- 具体例を見ながら考える方法\n- どこまで無料情報で足りるか\n- 続きへ進むべきタイミング\n\n対象読者:\n入口は分かったけれど、もう少し具体例で確認したい人向けです。\n\n読まなくていい人:\n${notFor}\n\n得られる成果:\n${expectedOutcome}\n\n${destinationArticle.title}\n${FREE_ARTICLE_CTA_URL}`;
  }

  return `最後に、必要な人だけ次へ進んでください。\n\nこの続きで分かること:\n- ${topic}で失敗しやすいパターン\n- 具体例を見た時の見る場所\n- 迷った時に戻る順番\n- 自分の作業に当てはめる考え方\n\n対象読者:\n無料記事で考え方は分かったので、次は具体例で確認したい人向けです。\n\n読まなくていい人:\n${notFor}\n\n得られる成果:\n${expectedOutcome}\n\n${destinationArticle.title}\n${FREE_ARTICLE_CTA_URL}`;
}

export function generateFreeArticleIdeas(
  article: FreeArticleDestination,
  history: FreeArticleHistory,
  focusCategory?: string,
) {
  return templateFreeArticleGenerator.generateIdeas(article, history, focusCategory);
}

export function generateFreeArticleDraft(
  selectedIdea: FreeArticleIdeaForDraft,
  context: FreeArticleDraftContext,
) {
  return templateFreeArticleGenerator.generateDraft(selectedIdea, context);
}
