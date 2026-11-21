import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMetricsCsv,
  metricsCsvHeaders,
  resolveMetricsExportPeriod,
  type MetricsCsvRow,
} from "../features/exports/csv.ts";
import { formatTokyoDateInputValue } from "../features/metrics/calculators.ts";

const headerLine = metricsCsvHeaders.join(",");
const bom = "\uFEFF";

function createRow(overrides: Partial<MetricsCsvRow> = {}): MetricsCsvRow {
  return {
    date: new Date("2026-11-20T15:00:00.000Z"),
    articleId: "a1",
    title: "日本語の記事",
    price: 500,
    pv: 100,
    purchases: 5,
    revenue: 2500,
    masterTransitions: 1,
    ...overrides,
  };
}

test("CSV headers have the expected columns in order", () => {
  assert.deepEqual(metricsCsvHeaders, [
    "date",
    "articleId",
    "title",
    "price",
    "pv",
    "purchases",
    "conversionRate",
    "revenue",
    "masterTransitions",
    "masterTransitionRate",
  ]);
});

test("empty CSV contains the BOM, header line, and trailing CRLF", () => {
  assert.equal(buildMetricsCsv([]), `${bom}${headerLine}\r\n`);
});

test("one normal Japanese row is formatted as a full CSV string", () => {
  const title = "日本語の記事";
  const expectedLine = "2026-11-21,a1,日本語の記事,500,100,5,5.00,2500,1,20.00";
  const csv = buildMetricsCsv([createRow({ title })]);

  assert.equal(csv, `${bom}${headerLine}\r\n${expectedLine}\r\n`);
  assert.ok(csv.includes(`,${title},`));
  assert.ok(!csv.includes(`,"${title}"`));
});

test("a comma in a title is escaped by quoting the field", () => {
  const csv = buildMetricsCsv([createRow({ title: "記事,特集" })]);
  assert.ok(csv.includes('2026-11-21,a1,"記事,特集",500'));
});

test("a double quote in a title is doubled and the field is quoted", () => {
  const csv = buildMetricsCsv([createRow({ title: '記事"特集' })]);
  assert.ok(csv.includes('2026-11-21,a1,"記事""特集",500'));
});

test("a newline in a title is preserved inside a quoted field", () => {
  const title = "記事\n特集";
  const csv = buildMetricsCsv([createRow({ title })]);
  assert.ok(csv.includes(`2026-11-21,a1,"${title}",500`));
});

test("zero denominators produce zero rates", () => {
  const conversionCsv = buildMetricsCsv([
    createRow({ pv: 0, purchases: 5, masterTransitions: 1 }),
  ]);
  const transitionCsv = buildMetricsCsv([
    createRow({ pv: 100, purchases: 0, masterTransitions: 1 }),
  ]);

  assert.ok(conversionCsv.includes(",0,5,0.00,2500,1,"));
  assert.ok(transitionCsv.includes(",100,0,0.00,2500,1,0.00\r\n"));
});

test("day scope resolves Tokyo date bounds and filename", () => {
  const period = resolveMetricsExportPeriod(
    new URLSearchParams("scope=day&date=2026-11-21"),
  );

  assert.equal(period.fromInput, "2026-11-21");
  assert.equal(period.toInput, "2026-11-21");
  assert.equal(period.filename, "note-metrics_2026-11-21.csv");
  assert.equal(period.from.toISOString(), "2026-11-20T15:00:00.000Z");
  assert.equal(period.exclusiveTo.toISOString(), "2026-11-21T15:00:00.000Z");
});

test("invalid day scope falls back to Tokyo today", () => {
  const period = resolveMetricsExportPeriod(
    new URLSearchParams("scope=day&date=not-a-date"),
  );
  const today = formatTokyoDateInputValue(new Date());

  assert.equal(period.fromInput, today);
  assert.equal(period.toInput, today);
  assert.equal(period.filename, `note-metrics_${today}.csv`);
});

test("range scope wires the period dates into its filename", () => {
  const period = resolveMetricsExportPeriod(new URLSearchParams("range=7d"));
  const today = formatTokyoDateInputValue(new Date());

  assert.equal(period.toInput, today);
  assert.equal(
    period.filename,
    `note-metrics_${period.fromInput}_${period.toInput}.csv`,
  );
});
