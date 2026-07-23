export const sensitiveSalesHeaders = [
  "購入者名",
  "取引ID",
  "発行事業者",
  "適格事業者登録番号",
] as const;

const sensitiveHeaderSet = new Set<string>(sensitiveSalesHeaders);

export type PrivacyFilteredSalesRow = {
  values: Record<string, string>;
  removedFields: string[];
};

export function filterSensitiveSalesFields(
  headers: string[],
  row: string[],
): PrivacyFilteredSalesRow {
  const values: Record<string, string> = {};
  const removedFields: string[] = [];

  headers.forEach((header, index) => {
    if (sensitiveHeaderSet.has(header)) {
      removedFields.push(header);
      return;
    }

    values[header] = row[index]?.trim() ?? "";
  });

  return { values, removedFields };
}

export function containsSensitiveSalesField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveSalesField);
  if (value === null || typeof value !== "object") return false;

  return Object.entries(value).some(
    ([key, nested]) => sensitiveHeaderSet.has(key) || containsSensitiveSalesField(nested),
  );
}
