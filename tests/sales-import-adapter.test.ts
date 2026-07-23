import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  canonicalSalesSchemaVersion,
  containsSensitiveSalesField,
  CsvSalesAdapterV1,
  detectCrossSourceSalesDuplicates,
  filterSensitiveSalesFields,
  runSalesImportAdapter,
  sensitiveSalesHeaders,
  validateCanonicalSale,
} from "../features/imports/import-pipeline/index.ts";

const header =
  "\uFEFF決済/返金日時,購入者名,決済種別,決済方法,コンテンツ種別,コンテンツ名,販売額,消費税率,税抜販売額,消費税額,ポイント利用,取引ID,発行事業者,適格事業者登録番号";

function csv(...rows: string[]) {
  return Buffer.from([header, ...rows].join("\n"), "utf8");
}

function sourceHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

test("fixes Canonical Sales Schema v1.0 minimum fields", () => {
  const sale = {
    saleDate: "2026-07-15T09:00:00+09:00",
    productName: "匿名商品",
    quantity: 1,
    grossAmount: 1000,
    netAmount: 909,
    currency: "JPY",
    platform: "note" as const,
    source: "note-sales-csv:v1",
    confidence: 0.98,
  };

  assert.equal(canonicalSalesSchemaVersion, "1.0");
  assert.deepEqual(Object.keys(sale), [
    "saleDate",
    "productName",
    "quantity",
    "grossAmount",
    "netAmount",
    "currency",
    "platform",
    "source",
    "confidence",
  ]);
  assert.equal(validateCanonicalSale(sale).ok, true);
});

test("CSV Adapter v1 maps sales and refunds without retaining sensitive values", () => {
  const input = csv(
    "20260715090000,PERSONAL_VALUE,販売,カード,記事,匿名商品,1000,10,909,91,0,PRIVATE_TX,PRIVATE_ISSUER,PRIVATE_REG",
    "20260716090000,PERSONAL_VALUE,返金,カード,記事,匿名商品,1000,10,909,91,0,PRIVATE_TX_2,PRIVATE_ISSUER,PRIVATE_REG",
  );
  const result = runSalesImportAdapter([new CsvSalesAdapterV1()], {
    buffer: input,
    sourceHash: sourceHash(input),
  });

  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].quantity, 1);
  assert.equal(result.records[0].grossAmount, 1000);
  assert.equal(result.records[0].netAmount, 909);
  assert.equal(result.records[1].quantity, -1);
  assert.equal(result.records[1].grossAmount, -1000);
  assert.equal(result.records[1].netAmount, -909);
  assert.equal(containsSensitiveSalesField(result), false);
  assert.deepEqual(result.privacy.removedFields, sensitiveSalesHeaders);
  assert.doesNotMatch(JSON.stringify(result), /PERSONAL_VALUE|PRIVATE_TX|PRIVATE_REG/);
});

test("Privacy Filter removes purchaser, transaction, issuer, and registration fields", () => {
  const headers = ["購入者名", "コンテンツ名", "取引ID", "発行事業者", "適格事業者登録番号"];
  const filtered = filterSensitiveSalesFields(headers, [
    "PRIVATE_PERSON",
    "匿名商品",
    "PRIVATE_TX",
    "PRIVATE_ISSUER",
    "PRIVATE_REG",
  ]);

  assert.deepEqual(filtered.values, { コンテンツ名: "匿名商品" });
  assert.equal(containsSensitiveSalesField(filtered.values), false);
  assert.doesNotMatch(JSON.stringify(filtered), /PRIVATE_PERSON|PRIVATE_TX|PRIVATE_REG/);
});

test("detects duplicate candidates across files without transaction identifiers", () => {
  const adapter = new CsvSalesAdapterV1();
  const first = csv(
    "20260715090000,PRIVATE_A,販売,カード,記事,匿名商品,1000,10,909,91,0,PRIVATE_TX_A,PRIVATE_ISSUER,PRIVATE_REG",
  );
  const second = csv(
    "20260715090000,PRIVATE_B,販売,カード,記事,匿名商品,1000,10,909,91,0,PRIVATE_TX_B,PRIVATE_ISSUER,PRIVATE_REG",
  );
  const firstHash = sourceHash(first);
  const secondHash = sourceHash(second);
  const firstResult = adapter.adapt({ buffer: first, sourceHash: firstHash });
  const secondResult = adapter.adapt({ buffer: second, sourceHash: secondHash });
  const duplicates = detectCrossSourceSalesDuplicates([
    { sourceHash: firstHash, rowNumber: 2, sale: firstResult.records[0] },
    { sourceHash: secondHash, rowNumber: 2, sale: secondResult.records[0] },
  ]);

  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].records.length, 2);
  assert.doesNotMatch(JSON.stringify(duplicates), /PRIVATE_A|PRIVATE_TX/);
});

test("does not persist, update Data Layer, or require a database", () => {
  const adapter = new CsvSalesAdapterV1();

  assert.equal("persist" in adapter, false);
  assert.equal("prisma" in adapter, false);
  assert.equal("database" in adapter, false);
});
