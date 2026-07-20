import { normalizeArticleTitle } from "@/features/imports/note-profile/matcher";
import { normalizeOcrTitle } from "./normalizer";

type ParsedOcrItem = {
  extractedTitle: string;
  normalizedTitle: string;
  extractedPv: number;
  originalOcrLine: string;
};

const pvPattern = /([0-9][0-9,]*)\s*(?:PV|pv|ビュー|view|views)?/g;
const strictPvLinePattern =
  /^(?:PV|pv|ビュー|閲覧数|view|views)?\s*([0-9][0-9,]*)\s*(?:PV|pv|ビュー|view|views)?$/;
const titleTrailingPvPattern =
  /(?:\s|　)+([0-9][0-9,]*)\s*(?:PV|pv|ビュー|view|views)?\s*$/;
const dateOrTimePattern =
  /(?:20\d{2}[/-]\d{1,2}[/-]\d{1,2}|20\d{2}年|[0-2]?\d:[0-5]\d|最終|集計|時刻|更新|期間)/;
const noteAccessNoisePattern =
  /(?:サポート|ヘルプ|お問い合わせ|最終集計|集計時刻|アクセス状況|ダッシュボード|全体ビュー|記事別|記事ごと|記事タイトル|閲覧数|ビュー|公開日|前日比|合計|期間|表示|もっとみる|もっと見る|note pro|メニュー|ホーム|通知|設定|分析|アクセス|読まれた記事)/i;

function normalizeLine(line: string) {
  return line
    .replace(/[｜|]/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOcrLines(text: string) {
  return text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);
}

function isNoiseLine(line: string) {
  const normalized = normalizeArticleTitle(line);

  return (
    normalized === "" ||
    noteAccessNoisePattern.test(line) ||
    dateOrTimePattern.test(line) ||
    normalized === "記事" ||
    normalized === "記事タイトル" ||
    normalized === "タイトル" ||
    normalized === "アクセス状況" ||
    normalized === "全体ビュー" ||
    normalized === "閲覧数" ||
    normalized === "ビュー" ||
    normalized === "公開日" ||
    normalized === "ダッシュボード" ||
    /^[0-9,\sPVpvビューviewviews]+$/.test(line) ||
    /^[年月日\s/:：.,，-]+$/.test(line)
  );
}

function parsePv(line: string) {
  const matches = Array.from(line.matchAll(pvPattern));

  if (matches.length === 0) {
    return null;
  }

  const value = Number(matches[matches.length - 1][1].replaceAll(",", ""));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function parseTrailingPvFromTableLine(line: string) {
  if (!line || isNoiseLine(line) || dateOrTimePattern.test(line)) {
    return null;
  }

  const match = line.match(titleTrailingPvPattern);
  if (!match) {
    return null;
  }

  const title = sanitizeTitleLine(line);
  const pv = Number(match[1].replaceAll(",", ""));

  if (!isValidTitleLine(title) || !Number.isInteger(pv) || pv < 0) {
    return null;
  }

  return { title, pv };
}

function parsePvColumnLine(line: string) {
  const normalized = normalizeLine(line);

  if (!normalized || isNoiseLine(normalized) || dateOrTimePattern.test(normalized)) {
    return null;
  }

  const strictMatch = normalized.match(strictPvLinePattern);

  if (!strictMatch) {
    return null;
  }

  const value = Number(strictMatch[1].replaceAll(",", ""));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function removeTrailingPv(line: string) {
  return line
    .replace(titleTrailingPvPattern, "")
    .trim();
}

function sanitizeTitleLine(line: string) {
  return normalizeOcrTitle(removeTrailingPv(line))
    .replace(/^(?:記事|タイトル|記事タイトル)\s*/, "")
    .replace(/\s*(?:PV|pv|ビュー|閲覧数)$/i, "")
    .trim();
}

function isValidTitleLine(line: string) {
  const title = sanitizeTitleLine(line);
  const normalized = normalizeArticleTitle(title);

  if (!title || isNoiseLine(title)) {
    return false;
  }

  if (
    parsePvColumnLine(title) !== null ||
    (parsePv(title) !== null && normalized.length <= 6)
  ) {
    return false;
  }

  if (normalized.length < 6) {
    return false;
  }

  return /[ぁ-んァ-ヶ一-龠A-Za-z]/.test(title);
}

function extractTitleLines(text: string) {
  return normalizeOcrLines(text)
    .map(sanitizeTitleLine)
    .filter(isValidTitleLine);
}

function extractPvValues(text: string) {
  return normalizeOcrLines(text)
    .map(parsePvColumnLine)
    .filter((value): value is number => value !== null);
}

function distributeTitleLines(titleLines: string[], targetCount: number) {
  if (targetCount <= 0 || titleLines.length <= targetCount) {
    return titleLines;
  }

  const groups = Array.from({ length: targetCount }, () => [] as string[]);
  const ratio = titleLines.length / targetCount;

  titleLines.forEach((line, index) => {
    const groupIndex = Math.min(targetCount - 1, Math.floor(index / ratio));
    groups[groupIndex].push(line);
  });

  return groups
    .map((group) => normalizeOcrTitle(group.join("")))
    .filter(Boolean);
}

function findTitleBefore(lines: string[], pvLineIndex: number) {
  for (let index = pvLineIndex - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (!line || isNoiseLine(line)) {
      continue;
    }

    return line;
  }

  return null;
}

export function parseNoteAccessOcrText(text: string): ParsedOcrItem[] {
  const lines = normalizeOcrLines(text);
  const items: ParsedOcrItem[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    const sameLine = parseTrailingPvFromTableLine(line);

    if (sameLine) {
      const key = `${normalizeArticleTitle(sameLine.title)}:${sameLine.pv}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      items.push({
        extractedTitle: sameLine.title,
        normalizedTitle: normalizeOcrTitle(sameLine.title),
        extractedPv: sameLine.pv,
        originalOcrLine: line,
      });
      return;
    }

    const pv = parsePvColumnLine(line);

    if (pv === null) {
      return;
    }

    const title = findTitleBefore(lines, index);

    if (!title || !isValidTitleLine(title)) {
      return;
    }

    const key = `${normalizeArticleTitle(title)}:${pv}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push({
      extractedTitle: title,
      normalizedTitle: normalizeOcrTitle(title),
      extractedPv: pv,
      originalOcrLine: line,
    });
  });

  return items;
}

export function parseNoteAccessColumnOcrText({
  titleText,
  pvText,
  fallbackText,
}: {
  titleText: string;
  pvText: string;
  fallbackText: string;
}) {
  const rawTitleLines = extractTitleLines(titleText);
  const pvValues = extractPvValues(pvText);
  const titleLines = distributeTitleLines(rawTitleLines, pvValues.length);
  const items: ParsedOcrItem[] = [];
  const length = Math.min(titleLines.length, pvValues.length);
  const seen = new Set<string>();

  for (let index = 0; index < length; index += 1) {
    const title = titleLines[index];
    const pv = pvValues[index];
    const key = `${normalizeArticleTitle(title)}:${pv}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push({
      extractedTitle: title,
      normalizedTitle: normalizeOcrTitle(title),
      extractedPv: pv,
      originalOcrLine: `title: ${title} / pv: ${pv}`,
    });
  }

  return items.length > 0 ? items : parseNoteAccessOcrText(fallbackText);
}
