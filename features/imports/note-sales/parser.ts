import {
  noteSalesExpectedHeaders,
  type NoteSalesRowIssue,
  type ParsedNoteSaleRow,
} from "./types";

const dateTimePattern = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (isQuoted) {
      if (character === "\"" && nextCharacter === "\"") {
        currentField += "\"";
        index += 1;
        continue;
      }

      if (character === "\"") {
        isQuoted = false;
        continue;
      }

      currentField += character;
      continue;
    }

    if (character === "\"") {
      isQuoted = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    if (character === "\r") {
      continue;
    }

    currentField += character;
  }

  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((field) => field.trim() !== ""));
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function normalizeHeader(value: string, index: number) {
  return index === 0 ? stripBom(value).trim() : value.trim();
}

function validateHeaders(headers: string[]) {
  if (headers.length !== noteSalesExpectedHeaders.length) {
    return `ヘッダー数が一致しません。期待値 ${noteSalesExpectedHeaders.length} 列、実際 ${headers.length} 列です。`;
  }

  const invalidIndex = noteSalesExpectedHeaders.findIndex(
    (header, index) => headers[index] !== header,
  );

  if (invalidIndex >= 0) {
    return `ヘッダー「${noteSalesExpectedHeaders[invalidIndex]}」が見つかりません。`;
  }

  return null;
}

function parseTokyoDateTime(value: string) {
  const match = dateTimePattern.exec(value);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const occurredAt = new Date(
    Date.UTC(year, month - 1, day, hour - 9, minute, second),
  );
  const date = new Date(Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter
    .formatToParts(occurredAt)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  if (
    parts.year !== yearText ||
    parts.month !== monthText ||
    parts.day !== dayText ||
    parts.hour !== hourText ||
    parts.minute !== minuteText ||
    parts.second !== secondText
  ) {
    return null;
  }

  return {
    occurredAt,
    date,
    dateInput: `${yearText}-${monthText}-${dayText}`,
  };
}

export function parseNoteSalesCsv({
  fileName,
  text,
}: {
  fileName: string;
  text: string;
}) {
  const rows = parseCsv(text);
  const issues: NoteSalesRowIssue[] = [];
  const parsedRows: ParsedNoteSaleRow[] = [];

  if (rows.length === 0) {
    return {
      totalRows: 0,
      parsedRows,
      issues: [
        {
          fileName,
          rowNumber: 1,
          severity: "error" as const,
          reason: "CSVが空です。",
        },
      ],
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const headerError = validateHeaders(headers);

  if (headerError) {
    return {
      totalRows: Math.max(rows.length - 1, 0),
      parsedRows,
      issues: [
        {
          fileName,
          rowNumber: 1,
          severity: "error" as const,
          reason: headerError,
        },
      ],
    };
  }

  rows.slice(1).forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;

    if (row.length !== noteSalesExpectedHeaders.length) {
      issues.push({
        fileName,
        rowNumber,
        severity: "error",
        reason: `列数が一致しません。期待値 ${noteSalesExpectedHeaders.length} 列、実際 ${row.length} 列です。`,
      });
      return;
    }

    const values = Object.fromEntries(
      noteSalesExpectedHeaders.map((header, index) => [header, row[index].trim()]),
    );
    const rawType = values["決済種別"];
    const rawAmount = values["販売額"];
    const title = values["コンテンツ名"];
    const transactionId = values["取引ID"];
    const parsedDate = parseTokyoDateTime(values["決済/返金日時"]);
    const amount = Number(rawAmount);

    if (!parsedDate) {
      issues.push({
        fileName,
        rowNumber,
        severity: "error",
        reason: "決済/返金日時はYYYYMMDDHHmmss形式で入力してください。",
      });
      return;
    }

    if (rawType !== "販売" && rawType !== "返金") {
      issues.push({
        fileName,
        rowNumber,
        severity: "skip",
        reason: `決済種別「${rawType || "空欄"}」は取り込み対象外です。`,
      });
      return;
    }

    if (title === "") {
      issues.push({
        fileName,
        rowNumber,
        severity: "error",
        reason: "コンテンツ名が空です。",
      });
      return;
    }

    if (transactionId === "") {
      issues.push({
        fileName,
        rowNumber,
        severity: "error",
        reason: "取引IDが空です。",
      });
      return;
    }

    if (!Number.isInteger(amount) || amount < 0) {
      issues.push({
        fileName,
        rowNumber,
        severity: "error",
        reason: "販売額は0以上の整数で入力してください。",
      });
      return;
    }

    parsedRows.push({
      fileName,
      rowNumber,
      transactionId,
      occurredAt: parsedDate.occurredAt.toISOString(),
      dateInput: parsedDate.dateInput,
      type: rawType,
      contentType: values["コンテンツ種別"],
      title,
        amount,
      });
  });

  return {
    totalRows: Math.max(rows.length - 1, 0),
    parsedRows,
    issues,
  };
}
