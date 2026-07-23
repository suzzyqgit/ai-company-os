export const canonicalSalesSchemaVersion = "1.0";

export const salesPlatforms = ["note", "unknown"] as const;

export type SalesPlatform = (typeof salesPlatforms)[number];

export type CanonicalSale = {
  saleDate: string;
  productName: string;
  quantity: number;
  grossAmount: number;
  netAmount: number | null;
  currency: string;
  platform: SalesPlatform;
  source: string;
  confidence: number;
};

export type CanonicalSaleValidation = {
  ok: boolean;
  issues: string[];
};

export function validateCanonicalSale(sale: CanonicalSale): CanonicalSaleValidation {
  const issues: string[] = [];

  if (Number.isNaN(Date.parse(sale.saleDate))) issues.push("sale_date_invalid");
  if (sale.productName.trim() === "") issues.push("product_name_missing");
  if (!Number.isInteger(sale.quantity) || sale.quantity === 0) {
    issues.push("quantity_must_be_non_zero_integer");
  }
  if (!Number.isFinite(sale.grossAmount)) issues.push("gross_amount_invalid");
  if (sale.netAmount !== null && !Number.isFinite(sale.netAmount)) {
    issues.push("net_amount_invalid");
  }
  if (!/^[A-Z]{3}$/.test(sale.currency)) issues.push("currency_invalid");
  if (!salesPlatforms.includes(sale.platform)) issues.push("platform_invalid");
  if (sale.source.trim() === "") issues.push("source_missing");
  if (!Number.isFinite(sale.confidence) || sale.confidence < 0 || sale.confidence > 1) {
    issues.push("confidence_out_of_range");
  }

  return { ok: issues.length === 0, issues };
}
