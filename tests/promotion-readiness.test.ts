import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeProductName,
  runPromotionReadinessDryRun,
} from "../features/imports/import-pipeline/index.ts";

const header = "決済/返金日時,購入者名,決済種別,決済方法,コンテンツ種別,コンテンツ名,販売額,消費税率,税抜販売額,消費税額,ポイント利用,取引ID,発行事業者,適格事業者登録番号";
const row = "20260715090000,private,販売,card,記事,商品　A,1000,10,909,91,0,private-id,private-company,private-number";
const source = { sourceName: "anonymous.csv", buffer: Buffer.from(`${header}\n${row}\n`) };

test("DRY_RUN validates three approval layers without persistent writes", () => {
  const report = runPromotionReadinessDryRun({ sources: [source] });
  assert.equal(report.recordCount, 1);
  assert.equal(report.approvedRecordCount, 1);
  assert.equal(report.approvedSourceCount, 1);
  assert.equal(report.runStatus, "COMPLETED");
  assert.equal(report.runApprovalStatus, "APPROVED");
  assert.equal(report.persistentWrites, 0);
  assert.equal(report.records[0].candidateArticleId, null);
});

test("DRY_RUN is deterministic and repeatable", () => {
  const first = runPromotionReadinessDryRun({ sources: [source] });
  const second = runPromotionReadinessDryRun({ sources: [source] });
  assert.equal(first.inputFingerprint, second.inputFingerprint);
  assert.deepEqual(first, second);
});

test("COMMIT is unavailable before Phase 2", () => {
  assert.throws(
    () => runPromotionReadinessDryRun({ mode: "COMMIT", sources: [source] }),
    /reserved for Phase 2/,
  );
});

test("product matching fields remain candidates only", () => {
  assert.equal(normalizeProductName(" 商品　A "), "商品 A");
  const [record] = runPromotionReadinessDryRun({ sources: [source] }).records;
  assert.equal(record.normalizedProductName, "商品 A");
  assert.equal(record.candidateProductId, null);
  assert.equal(record.matchConfidence, null);
});
