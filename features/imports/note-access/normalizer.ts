const trailingOcrGarbagePattern =
  /(?:\s|[|｜:：,，.。・\-—_])+((?:sa6|1e|ga|©|@|[a-z]{1,3}|\d[a-z]|[a-z]\d){1,3})$/i;
const decorativeBracketPattern =
  /[【\[\(（「『][^】\]\)）」』]*(?:20\d{2}年?|最新版|完全版|改訂版|保存版|初回|限定)[^】\]\)）」』]*[】\]\)）」』]/gi;
const decorativeWordsPattern =
  /(?:20\d{2}年?|最新版|完全版|改訂版)/gi;
const ocrNoiseSymbolsPattern = /[©@®™★☆※◆◇■□●○◎▲△▼▽�]+/g;

export function normalizeOcrTitle(title: string) {
  let normalized = title
    .normalize("NFKC")
    .replace(/\r?\n/g, "")
    .replace(/[\u3000\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (let count = 0; count < 3; count += 1) {
    const next = normalized.replace(trailingOcrGarbagePattern, "").trim();

    if (next === normalized) {
      break;
    }

    normalized = next;
  }

  return normalized
    .replace(/[©@]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitleForMatching(title: string) {
  return normalizeOcrTitle(title)
    .replace(decorativeBracketPattern, " ")
    .replace(/[【】()[\]（）「」『』]/g, " ")
    .replace(decorativeWordsPattern, " ")
    .replace(ocrNoiseSymbolsPattern, " ")
    .replace(/[|｜:：,，.。・\-—_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~「」『』【】（）［］｛｝、。，．・…〜～！？\s]/g, "");
}

export const normalizedForMatch = normalizeTitleForMatching;
