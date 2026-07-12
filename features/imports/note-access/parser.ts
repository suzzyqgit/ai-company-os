import { normalizeArticleTitle } from "@/features/imports/note-profile/matcher";
import { normalizeOcrTitle } from "./normalizer";

type ParsedOcrItem = {
  extractedTitle: string;
  normalizedTitle: string;
  extractedPv: number;
  originalOcrLine: string;
};

const pvPattern = /([0-9][0-9,]*)\s*(?:PV|pv|ビュー|view|views)?/g;

function normalizeLine(line: string) {
  return line
    .replace(/[｜|]/g, " ")
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
    normalized === "記事" ||
    normalized === "記事タイトル" ||
    normalized === "タイトル" ||
    normalized === "アクセス状況" ||
    normalized === "全体ビュー" ||
    normalized === "閲覧数" ||
    normalized === "ビュー" ||
    normalized === "公開日" ||
    normalized === "ダッシュボード" ||
    /^[0-9,\sPVpvビューviewviews]+$/.test(line)
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

function removeTrailingPv(line: string) {
  return line
    .replace(/\s+[0-9][0-9,]*\s*(?:PV|pv|ビュー|view|views)?\s*$/, "")
    .trim();
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
    const pv = parsePv(line);

    if (pv === null) {
      return;
    }

    const sameLineTitle = removeTrailingPv(line);
    const title = isNoiseLine(sameLineTitle)
      ? findTitleBefore(lines, index)
      : sameLineTitle;

    if (!title) {
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
  const titleLines = normalizeOcrLines(titleText)
    .map(normalizeOcrTitle)
    .filter((line) => !isNoiseLine(line));
  const pvValues = normalizeOcrLines(pvText)
    .map(parsePv)
    .filter((value): value is number => value !== null);
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
      originalOcrLine: `${title} ${pv}`,
    });
  }

  return items.length > 0 ? items : parseNoteAccessOcrText(fallbackText);
}
