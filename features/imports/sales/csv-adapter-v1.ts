import {
  canonicalSalesSchemaVersion,
  validateCanonicalSale,
  type CanonicalSale,
} from "./canonical-sales.ts";
import { filterSensitiveSalesFields, sensitiveSalesHeaders } from "./privacy-filter.ts";
import type {
  SalesAdapterInput,
  SalesAdapterResult,
  SalesImportAdapter,
  SalesImportIssue,
} from "./sales-import-adapter.ts";

export const noteSalesCsvHeaders = [
  "決済/返金日時",
  "購入者名",
  "決済種別",
  "決済方法",
  "コンテンツ種別",
  "コンテンツ名",
  "販売額",
  "消費税率",
  "税抜販売額",
  "消費税額",
  "ポイント利用",
  "取引ID",
  "発行事業者",
  "適格事業者登録番号",
] as const;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (character === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === "\"") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ""));
}

function normalizeHeaders(row: string[]) {
  return row.map((value, index) =>
    (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim(),
  );
}

function parseNoteDate(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function parseInteger(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function headersMatch(headers: string[]) {
  return (
    headers.length === noteSalesCsvHeaders.length &&
    noteSalesCsvHeaders.every((header, index) => headers[index] === header)
  );
}

export class CsvSalesAdapterV1 implements SalesImportAdapter {
  readonly id = "note-sales-csv";
  readonly version = "1";

  supports({ buffer }: SalesAdapterInput) {
    const headers = normalizeHeaders(parseCsv(buffer.toString("utf8"))[0] ?? []);
    return headersMatch(headers);
  }

  adapt({ buffer }: SalesAdapterInput): SalesAdapterResult {
    const rows = parseCsv(buffer.toString("utf8"));
    const headers = normalizeHeaders(rows[0] ?? []);
    const issues: SalesImportIssue[] = [];
    const records: CanonicalSale[] = [];

    if (!headersMatch(headers)) {
      return {
        adapterId: this.id,
        schemaVersion: canonicalSalesSchemaVersion,
        records: [],
        issues: [{ rowNumber: 1, code: "csv_header_mismatch", severity: "error" }],
        privacy: {
          removedFields: [...sensitiveSalesHeaders],
          sensitiveValuesRetained: false,
        },
      };
    }

    rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      if (row.length !== headers.length) {
        issues.push({ rowNumber, code: "csv_row_width_mismatch", severity: "error" });
        return;
      }

      const filtered = filterSensitiveSalesFields(headers, row);
      const value = filtered.values;
      const saleDate = parseNoteDate(value["決済/返金日時"]);
      const gross = parseInteger(value["販売額"]);
      const net = parseInteger(value["税抜販売額"]);
      const type = value["決済種別"];
      const sign = type === "返金" ? -1 : type === "販売" ? 1 : null;

      if (!saleDate || gross === null || net === null || sign === null) {
        issues.push({ rowNumber, code: "csv_row_unresolved", severity: "error" });
        return;
      }

      const record = {
        saleDate,
        productName: value["コンテンツ名"] ?? "",
        quantity: sign,
        grossAmount: sign * gross,
        netAmount: sign * net,
        currency: "JPY",
        platform: "note" as const,
        source: `${this.id}:v${this.version}`,
        confidence: 0.98,
      };
      const validation = validateCanonicalSale(record);

      if (!validation.ok) {
        validation.issues.forEach((code) =>
          issues.push({ rowNumber, code, severity: "error" }),
        );
        return;
      }

      records.push(record);
    });

    return {
      adapterId: this.id,
      schemaVersion: canonicalSalesSchemaVersion,
      records,
      issues,
      privacy: {
        removedFields: [...sensitiveSalesHeaders],
        sensitiveValuesRetained: false,
      },
    };
  }
}
