import type { CanonicalSale } from "./canonical-sales.ts";

export type SalesImportIssue = {
  rowNumber: number | null;
  code: string;
  severity: "error" | "warning";
};

export type SalesAdapterInput = {
  buffer: Buffer;
  sourceHash: string;
};

export type SalesAdapterResult = {
  adapterId: string;
  schemaVersion: string;
  records: CanonicalSale[];
  issues: SalesImportIssue[];
  privacy: {
    removedFields: string[];
    sensitiveValuesRetained: false;
  };
};

export interface SalesImportAdapter {
  readonly id: string;
  readonly version: string;
  supports(input: SalesAdapterInput): boolean;
  adapt(input: SalesAdapterInput): SalesAdapterResult;
}

export function runSalesImportAdapter(
  adapters: SalesImportAdapter[],
  input: SalesAdapterInput,
): SalesAdapterResult {
  const adapter = adapters.find((candidate) => candidate.supports(input));

  if (!adapter) {
    return {
      adapterId: "unsupported",
      schemaVersion: "1.0",
      records: [],
      issues: [{ rowNumber: null, code: "sales_adapter_not_found", severity: "error" }],
      privacy: { removedFields: [], sensitiveValuesRetained: false },
    };
  }

  return adapter.adapt(input);
}
