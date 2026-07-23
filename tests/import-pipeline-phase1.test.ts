import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import {
  classifyCsvSource,
  classifyImageOcr,
  decideSnapshotPersist,
  extractSnapshotFromOcr,
  inspectCsvSource,
  normalizeSnapshot,
  validateSnapshot,
} from "../features/imports/import-pipeline/index.ts";

const sourceInspection = {
  sourceHash: "a".repeat(64),
  fileName: "fixture.png",
  fileSizeBytes: 1234,
  mime: "image/png",
  fileSignature: "89504E47",
};

function runSnapshotPipeline(ocrText: string) {
  const classification = classifyImageOcr({ ocrText });
  const extraction = extractSnapshotFromOcr(ocrText);
  const normalized = normalizeSnapshot({
    classification,
    extraction,
    inspection: sourceInspection,
  });
  const validation = validateSnapshot(normalized);
  const persistDecision = decideSnapshotPersist({ classification, validation });

  return {
    classification,
    extraction,
    normalized,
    validation,
    persistDecision,
  };
}

test("classifies and extracts YEARLY note access dashboard snapshots", () => {
  const result = runSnapshotPipeline(`
    note アクセス状況
    週 月 年 全期間
    2025年7月16日 - 2026年7月15日
    51,788 30 1,540
    全体ビュー コメント スキ
  `);

  assert.equal(result.classification.sourceKind, "note_access_dashboard");
  assert.equal(result.classification.snapshotType, "YEARLY");
  assert.equal(result.normalized?.periodStart, "2025-07-16");
  assert.equal(result.normalized?.periodEnd, "2026-07-15");
  assert.equal(result.normalized?.pv, 51788);
  assert.equal(result.normalized?.comments, 30);
  assert.equal(result.normalized?.likes, 1540);
  assert.equal(result.validation.ok, true);
  assert.equal(result.persistDecision.canPersistSnapshot, true);
  assert.equal(result.persistDecision.canUpdateArticlePv, false);
});

test("classifies and extracts MONTHLY note access dashboard snapshots", () => {
  const result = runSnapshotPipeline(`
    note アクセス状況
    月
    2026年6月16日 - 2026年7月15日
    2,670 1 43
    全体ビュー コメント スキ
  `);

  assert.equal(result.classification.snapshotType, "MONTHLY");
  assert.equal(result.normalized?.periodStart, "2026-06-16");
  assert.equal(result.normalized?.periodEnd, "2026-07-15");
  assert.equal(result.normalized?.pv, 2670);
  assert.equal(result.normalized?.comments, 1);
  assert.equal(result.normalized?.likes, 43);
  assert.equal(result.validation.ok, true);
  assert.equal(result.persistDecision.canUpdateArticlePv, false);
});

test("classifies and extracts WEEKLY note access dashboard snapshots", () => {
  const result = runSnapshotPipeline(`
    note アクセス状況
    週
    2026年7月9日 - 2026年7月15日
    492 0 10
    全体ビュー コメント スキ
  `);

  assert.equal(result.classification.snapshotType, "WEEKLY");
  assert.equal(result.normalized?.periodStart, "2026-07-09");
  assert.equal(result.normalized?.periodEnd, "2026-07-15");
  assert.equal(result.normalized?.pv, 492);
  assert.equal(result.normalized?.comments, 0);
  assert.equal(result.normalized?.likes, 10);
  assert.equal(result.validation.ok, true);
  assert.equal(result.persistDecision.canUpdateArticlePv, false);
});

test("rejects article-list screenshots as classification-only sources", () => {
  const ocrText = `
    記事一覧
    タイトル 価格 購入数 購入率 更新日
    安全な匿名タイトル ¥980 2 1.2% 2026-07-15
  `;
  const classification = classifyImageOcr({ ocrText });
  const extraction = extractSnapshotFromOcr(ocrText);
  const normalized = normalizeSnapshot({
    classification,
    extraction,
    inspection: sourceInspection,
  });
  const validation = validateSnapshot(normalized);
  const persistDecision = decideSnapshotPersist({ classification, validation });

  assert.equal(classification.sourceKind, "note_article_list");
  assert.equal(classification.snapshotType, null);
  assert.equal(normalized, null);
  assert.equal(persistDecision.canPersistSnapshot, false);
  assert.equal(persistDecision.canUpdateArticlePv, false);
});

test("does not convert unknown periods to ALL_TIME", () => {
  const result = runSnapshotPipeline(`
    note アクセス状況
    492 0 10
    全体ビュー コメント スキ
  `);

  assert.equal(result.classification.snapshotType, null);
  assert.equal(result.normalized, null);
  assert.equal(result.validation.ok, false);
  assert.ok(result.validation.issues.includes("normalized_snapshot_missing"));
});

test("does not coerce unreadable OCR values to zero", () => {
  const result = runSnapshotPipeline(`
    note アクセス状況
    週
    2026年7月9日 - 2026年7月15日
    読取不能 読取不能 読取不能
    全体ビュー コメント スキ
  `);

  assert.equal(result.extraction.pv, null);
  assert.equal(result.extraction.comments, null);
  assert.equal(result.extraction.likes, null);
  assert.equal(result.validation.ok, false);
});

test("detects an explicit selected tab that contradicts the displayed period", () => {
  const result = runSnapshotPipeline(`
    note アクセス状況
    選択中: 月
    2026年7月9日 - 2026年7月15日
    492 0 10
    全体ビュー コメント スキ
  `);

  assert.equal(result.classification.snapshotType, "MONTHLY");
  assert.equal(result.extraction.activeTab, "月");
  assert.equal(result.validation.ok, false);
  assert.ok(result.validation.issues.includes("snapshot_type_period_range_mismatch"));
  assert.equal(result.persistDecision.canPersistSnapshot, false);
});

test("requires extraction evidence before a snapshot can be persisted", () => {
  const result = runSnapshotPipeline(`
    note アクセス状況
    週
    2026年7月9日 - 2026年7月15日
    492 0 10
    全体ビュー コメント スキ
  `);
  const normalized = result.normalized && {
    ...result.normalized,
    evidence: [],
  };
  const validation = validateSnapshot(normalized);

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.includes("required_evidence_missing"));
});

test("classifies UTF-8 BOM note sales history CSV without extracting transactions", () => {
  const csv = [
    "\uFEFF決済/返金日時,購入者名,決済種別,決済方法,コンテンツ種別,コンテンツ名,販売額,消費税率,税抜販売額,消費税額,ポイント利用,取引ID,発行事業者,適格事業者登録番号",
    "20260715090000,,販売,カード,記事,匿名化テスト,1000,10,909,91,0,,,",
  ].join("\n");
  const inspection = inspectCsvSource({
    buffer: Buffer.from(csv, "utf8"),
    fileName: "anonymous-sales.csv",
  });
  const classification = classifyCsvSource(inspection);

  assert.equal(inspection.csv?.hasUtf8Bom, true);
  assert.equal(inspection.csv?.schemaCompatible, true);
  assert.equal(classification.sourceKind, "note_sales_history_csv");
  assert.equal(classification.snapshotType, null);
  assert.equal(classification.confidence, 0.98);
});

test("rejects invalid CSV sources safely", () => {
  const inspection = inspectCsvSource({
    buffer: Buffer.from("title,amount\nnot-note,100\n", "utf8"),
    fileName: "invalid.csv",
  });
  const classification = classifyCsvSource(inspection);

  assert.equal(classification.sourceKind, "unsupported");
  assert.equal(classification.reviewRequired, true);
  assert.ok(classification.evidence.rejectedKeywords.includes("utf8_bom_missing"));
  assert.ok(classification.evidence.rejectedKeywords.includes("sales_history_header_mismatch"));
});

test("fixtures do not contain purchaser names or transaction id values", () => {
  const fixtureText = [
    "匿名化テスト",
    "anonymous-sales.csv",
    "20260715090000,,販売,カード,記事,匿名化テスト,1000,10,909,91,0,,,",
  ].join("\n");

  assert.doesNotMatch(fixtureText, /buyer|purchaser|customer|txn|transaction-[A-Za-z0-9]/i);
  assert.doesNotMatch(fixtureText, /[A-Fa-f0-9]{32}/);
});
