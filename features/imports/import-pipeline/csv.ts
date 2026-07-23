import { createHash } from "node:crypto";
import { noteSalesExpectedHeaders } from "../note-sales/types.ts";
import type { SourceInspection } from "./types.ts";

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (quoted) {
      if (character === "\"" && nextCharacter === "\"") {
        field += "\"";
        index += 1;
        continue;
      }

      if (character === "\"") {
        quoted = false;
        continue;
      }

      field += character;
      continue;
    }

    if (character === "\"") {
      quoted = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (character !== "\r") {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ""));
}

function normalizeHeader(value: string, index: number) {
  const stripped = index === 0 ? value.replace(/^\uFEFF/, "") : value;
  return stripped.trim();
}

function isUtf8(buffer: Buffer) {
  return Buffer.from(buffer.toString("utf8"), "utf8").equals(buffer);
}

export function inspectCsvSource({
  buffer,
  fileName,
  mime = "text/csv",
}: {
  buffer: Buffer;
  fileName: string;
  mime?: string | null;
}): SourceInspection {
  const text = buffer.toString("utf8");
  const rows = parseCsvRows(text);
  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const rowWidths = rows.map((row) => row.length);
  const schemaCompatible =
    headers.length === noteSalesExpectedHeaders.length &&
    noteSalesExpectedHeaders.every((header, index) => headers[index] === header);

  return {
    sourceHash: createHash("sha256").update(buffer).digest("hex"),
    fileName,
    fileSizeBytes: buffer.length,
    mime,
    fileSignature: buffer.subarray(0, 16).toString("hex").toUpperCase(),
    csv: {
      encoding: isUtf8(buffer) ? "utf-8" : "unknown",
      hasUtf8Bom:
        buffer.length >= 3 &&
        buffer[0] === 0xef &&
        buffer[1] === 0xbb &&
        buffer[2] === 0xbf,
      headers,
      rowCount: Math.max(rows.length - 1, 0),
      rowWidths,
      schemaCompatible,
    },
  };
}

export function classifyCsvSource(inspection: SourceInspection) {
  const csv = inspection.csv;
  const rejectedKeywords: string[] = [];

  if (!csv) {
    return {
      sourceKind: "unsupported" as const,
      snapshotType: null,
      confidence: 0,
      evidence: {
        matchedKeywords: [],
        rejectedKeywords: ["missing_csv_inspection"],
        layoutSignals: [],
      },
      reviewRequired: true,
      rejectionReason: "CSV inspection is missing.",
    };
  }

  if (csv.encoding !== "utf-8") {
    rejectedKeywords.push("encoding_not_utf8");
  }

  if (!csv.hasUtf8Bom) {
    rejectedKeywords.push("utf8_bom_missing");
  }

  if (!csv.schemaCompatible) {
    rejectedKeywords.push("sales_history_header_mismatch");
  }

  if (csv.rowWidths.some((width) => width !== noteSalesExpectedHeaders.length)) {
    rejectedKeywords.push("row_width_mismatch");
  }

  const ok = rejectedKeywords.length === 0 && csv.rowCount > 0;

  return {
    sourceKind: ok ? ("note_sales_history_csv" as const) : ("unsupported" as const),
    snapshotType: null,
    confidence: ok ? 0.98 : 0,
    evidence: {
      matchedKeywords: ok ? ["note_sales_expected_headers", "utf8_bom"] : [],
      rejectedKeywords,
      layoutSignals: [`row_count:${csv.rowCount}`],
    },
    reviewRequired: !ok,
    rejectionReason: ok ? null : "CSV is not a valid note sales history source.",
  };
}
