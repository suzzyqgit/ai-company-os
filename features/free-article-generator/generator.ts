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
  "初心者が最初に迷うポイントを解く",
  "似た選択肢との違いを整理する",
  "やりがちな失敗を先に避ける",
  "実践前の手順だけを見せる",
  "よくあるケースで自分ごと化する",
  "購入前の確認項目に落とし込む",
  "前提用語をやさしく整理する",
  "今なぜ必要かを短く伝える",
  "導入前の不安をほどく",
  "無料情報で止まる原因を説明する",
  "自己流で遠回りしない判断軸を示す",
  "購入後に成果を出す準備を促す",
  "読者の現状診断にする",
  "具体例から必要性を感じてもらう",
  "最初の一歩だけに絞る",
  "避けるべき判断を明確にする",
  "向いている人と向いていない人を分ける",
  "よくある誤解を解く",
  "次に読むべき理由を作る",
];

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
  const articleTitle = article.title;

  const problems: Record<string, string> = {
    悩み解決: `${articleTitle}が気になるが、今の悩みをどう整理すればいいか分からない`,
    初心者向け: `${articleTitle}の前提知識が足りず、いきなり購入するのが不安`,
    比較: `似た情報が多く、${articleTitle}が自分に必要か判断できない`,
    失敗回避: `自己流で進めて失敗したくない`,
    手順解説: `何から順番に進めればいいか分からない`,
    事例: `自分と近いケースで役立つか知りたい`,
    チェックリスト: `購入前に確認すべき点を抜け漏れなく見たい`,
    用語解説: `専門用語や前提が曖昧で内容を理解できるか不安`,
    トレンド: `今取り組むべき理由が分からない`,
    導入前の不安解消: `買ったあとに使いこなせるか不安`,
  };

  return problems[intent] ?? problems["悩み解決"];
}

function buildTargetReader(intent: string, article: FreeArticleDestination) {
  if (intent === "初心者向け" || intent === "用語解説") {
    return `${article.title}に興味はあるが、まだ前提知識を整理している読者`;
  }

  if (intent === "比較" || intent === "導入前の不安解消") {
    return `${article.title}を読むべきか比較検討している読者`;
  }

  return `${article.title}に関心があり、次に読むべき実践記事を探している読者`;
}

function buildExpectedCta(role: string, article: FreeArticleDestination) {
  if (role === "980円記事への送客") {
    return `${article.title}で具体的な手順を確認してもらう`;
  }

  if (role === "購入前教育") {
    return `無料記事で判断基準を整理し、${article.title}へ自然に進んでもらう`;
  }

  return `${article.title}を次の学習先として認識してもらう`;
}

function buildTitle(intent: string, theme: string) {
  const titlePatterns: Record<string, string> = {
    悩み解決: `${theme}で迷ったときに最初に整理すること`,
    初心者向け: `初心者が${theme}で遠回りしないための考え方`,
    比較: `${theme}を選ぶ前に見たい判断基準`,
    失敗回避: `${theme}でよくある失敗と避け方`,
    手順解説: `${theme}を始める前の3ステップ`,
    事例: `${theme}が必要になる人のよくあるケース`,
    チェックリスト: `${theme}の購入前チェックリスト`,
    用語解説: `${theme}を理解するための前提知識`,
    トレンド: `今${theme}を見直すべき理由`,
    導入前の不安解消: `${theme}に不安がある人へ伝えたいこと`,
  };

  return titlePatterns[intent] ?? `${theme}で最初に整理すること`;
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

  return noteKeywords || article.title;
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
        ? `${categoryPrefix}${referenceKeyword}から${article.title}へ進む前の判断軸`
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
    const titleIdeas = [
      idea.title,
      `${idea.readerProblem}を整理するための${idea.theme}`,
      `${idea.theme}で失敗しないための入口`,
      `${idea.targetReader}が最初に見るべき${idea.theme}`,
      `${idea.theme}から次の実践へ進む方法`,
    ];
    const headings = [
      `${idea.theme}で最初に整理すること`,
      `なぜ「${idea.readerProblem}」で止まりやすいのか`,
      `無料記事で確認する範囲と、深掘りすべき範囲`,
      `${context.destinationArticle.title}へ進む前の判断基準`,
    ];
    const purpose = `${context.destinationArticle.title}へ自然に送客する`;
    const introduction = `${idea.targetReader}にとって、いきなり有料記事を読むべきか判断するのは簡単ではありません。\n\n特に「${idea.readerProblem}」という状態だと、情報を集めても次の一歩が曖昧になりがちです。\n\nこの記事では「${idea.searchIntent}」の意図に合わせて、無料で整理できる範囲に絞って解説します。`;
    const body = `${headings[0]}\n\n${idea.theme}で大切なのは、細かいノウハウを出し切ることではありません。読者が今どこで止まっているのかを切り分け、次に確認すべき実践記事へ進める状態を作ることです。\n\n${headings[1]}\n\n多くの場合、止まってしまう原因は情報不足ではなく、情報の順番が整理されていないことです。無料記事では全体像、判断基準、不安の解消までに絞ると、読者は次の行動を選びやすくなります。\n\n${headings[2]}\n\n無料記事で扱う範囲は、悩みの整理、よくある失敗、購入前の判断基準です。一方で、具体的な手順、細かいテンプレート、実践時の注意点は送客先の記事で扱います。\n\n${headings[3]}\n\n1. 今の悩みが基礎知識の不足なのか、実践手順の不足なのかを分ける\n2. 自分に必要な判断基準を確認する\n3. 具体的な実践手順が必要なら、送客先の記事へ進む\n\nこの流れにすると、無料記事だけで完結しすぎず、読者にとって自然な導線になります。${context.memo ? `\n\n補足: ${context.memo}` : ""}`;
    const summary = `まとめると、${idea.theme}では「全部を無料で理解しきる」よりも、次に何を確認すべきかを決めることが大切です。\n\n${idea.readerProblem}で迷っている場合は、まず全体像を押さえたうえで、具体的な実践手順へ進んでください。`;
    const cta = buildCta(context);
    const outline = headings.map((heading, index) => `${index + 1}. ${heading}`).join("\n");
    const fullDraft = [`# ${idea.title}`, introduction, body, summary, cta].join("\n\n");

    return {
      titleIdeas,
      title: idea.title,
      theme: idea.theme,
      targetReader: idea.targetReader,
      readerProblem: idea.readerProblem,
      purpose,
      outline,
      body,
      introduction,
      headings,
      summary,
      cta,
      fullDraft,
    };
  },
};

function buildCta({
  destinationArticle,
  ctaStrength,
}: Pick<FreeArticleDraftContext, "destinationArticle" | "ctaStrength">) {
  if (ctaStrength === "strong") {
    return `ここまで読んで「具体的な手順まで知りたい」と感じた方は、次にこちらの記事を読んでください。\n\n${destinationArticle.title}\n${destinationArticle.noteUrl}\n\n無料記事では全体像と判断基準に絞りましたが、送客先の記事では実践手順・注意点・具体例まで踏み込んで解説しています。`;
  }

  if (ctaStrength === "soft") {
    return `より詳しい実践方法は、こちらの記事にまとめています。\n\n${destinationArticle.title}\n${destinationArticle.noteUrl}\n\n必要になったタイミングで読めるように、ブックマークしておくのがおすすめです。`;
  }

  return `次のステップとして、詳しい実践方法はこちらにまとめています。\n\n${destinationArticle.title}\n${destinationArticle.noteUrl}`;
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
