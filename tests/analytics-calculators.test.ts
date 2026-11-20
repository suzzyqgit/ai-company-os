import assert from "node:assert/strict";
import test from "node:test";
import {
  addMetricTotals,
  createEmptyTotals,
  divideRate,
  getComparisonMetrics,
  getDailyRows,
  getImprovementArticles,
  getMasterTransitionRate,
  getPurchaseRate,
  getTopArticles,
  getTopArticlesByPurchaseRate,
  resolveAnalyticsPeriod,
  type ArticleMetricSummary,
  type MetricTotals,
} from "../features/analytics/calculators.ts";

const fixedNow = new Date("2026-11-21T03:00:00.000Z");

function totals(overrides: Partial<MetricTotals> = {}): MetricTotals {
  return {
    pv: 0,
    purchases: 0,
    revenue: 0,
    masterTransitions: 0,
    ...overrides,
  };
}

function article(
  articleId: string,
  overrides: Partial<ArticleMetricSummary> = {},
): ArticleMetricSummary {
  return {
    articleId,
    title: articleId,
    pv: 100,
    purchases: 0,
    revenue: 0,
    masterTransitions: 0,
    ...overrides,
  };
}

test("divideRate and conversion rates handle normal and zero denominators", () => {
  assert.equal(divideRate(1, 4), 25);
  assert.equal(divideRate(10, 0), 0);

  const metrics = totals({ pv: 40, purchases: 10, masterTransitions: 2 });
  assert.equal(getPurchaseRate(metrics), 25);
  assert.equal(getMasterTransitionRate(metrics), 20);
  assert.equal(getPurchaseRate(totals()), 0);
  assert.equal(getMasterTransitionRate(totals({ purchases: 0 })), 0);
});

test("empty totals and adding totals preserve the mutating API", () => {
  assert.deepEqual(createEmptyTotals(), totals());

  const target = totals({ pv: 1, purchases: 2, revenue: 3, masterTransitions: 4 });
  const source = totals({ pv: 5, purchases: 6, revenue: 7, masterTransitions: 8 });
  assert.equal(addMetricTotals(target, source), undefined);
  assert.deepEqual(target, totals({ pv: 6, purchases: 8, revenue: 10, masterTransitions: 12 }));
});

test("resolveAnalyticsPeriod resolves Tokyo calendar ranges and previous periods", () => {
  const today = resolveAnalyticsPeriod({ range: "today", now: fixedNow });
  assert.deepEqual(
    [today.fromInput, today.toInput, today.days, today.previousFromInput, today.previousToInput],
    ["2026-11-21", "2026-11-21", 1, "2026-11-20", "2026-11-20"],
  );

  const yesterday = resolveAnalyticsPeriod({ range: "yesterday", now: fixedNow });
  assert.deepEqual([yesterday.fromInput, yesterday.toInput, yesterday.days], ["2026-11-20", "2026-11-20", 1]);

  const sevenDays = resolveAnalyticsPeriod({ range: "7d", now: fixedNow });
  assert.deepEqual(
    [sevenDays.fromInput, sevenDays.toInput, sevenDays.days, sevenDays.previousFromInput, sevenDays.previousToInput],
    ["2026-11-15", "2026-11-21", 7, "2026-11-08", "2026-11-14"],
  );

  const thirtyDays = resolveAnalyticsPeriod({ range: "30d", now: fixedNow });
  assert.deepEqual([thirtyDays.fromInput, thirtyDays.toInput, thirtyDays.days], ["2026-10-23", "2026-11-21", 30]);

  const thisMonth = resolveAnalyticsPeriod({ range: "thisMonth", now: fixedNow });
  assert.deepEqual([thisMonth.fromInput, thisMonth.toInput, thisMonth.days], ["2026-11-01", "2026-11-21", 21]);

  const lastMonth = resolveAnalyticsPeriod({ range: "lastMonth", now: fixedNow });
  assert.deepEqual([lastMonth.fromInput, lastMonth.toInput, lastMonth.days], ["2026-10-01", "2026-10-31", 31]);

  const custom = resolveAnalyticsPeriod({
    range: "custom",
    from: "2026-11-02",
    to: "2026-11-05",
    now: fixedNow,
  });
  assert.deepEqual([custom.range, custom.fromInput, custom.toInput, custom.days], ["custom", "2026-11-02", "2026-11-05", 4]);

  const invalidCustom = resolveAnalyticsPeriod({
    range: "custom",
    from: "2026-11-22",
    to: "2026-11-21",
    now: fixedNow,
  });
  assert.deepEqual(
    [invalidCustom.range, invalidCustom.fromInput, invalidCustom.toInput, invalidCustom.days],
    ["7d", "2026-11-15", "2026-11-21", 7],
  );

  const invalidRange = resolveAnalyticsPeriod({ range: "unknown", now: fixedNow });
  assert.deepEqual([invalidRange.range, invalidRange.fromInput, invalidRange.toInput, invalidRange.days], ["7d", "2026-11-15", "2026-11-21", 7]);
  assert.equal(sevenDays.exclusiveTo.toISOString(), "2026-11-21T15:00:00.000Z");
});

test("getDailyRows returns descending zero-valued rows for the period", () => {
  const period = resolveAnalyticsPeriod({ range: "7d", now: fixedNow });
  const rows = getDailyRows(period);

  assert.equal(rows.length, 7);
  assert.equal(rows[0].dateInput, "2026-11-21");
  assert.deepEqual(rows.map((row) => row.dateInput), [
    "2026-11-21",
    "2026-11-20",
    "2026-11-19",
    "2026-11-18",
    "2026-11-17",
    "2026-11-16",
    "2026-11-15",
  ]);
  assert.ok(rows.every(({ pv, purchases, revenue, masterTransitions }) =>
    pv === 0 && purchases === 0 && revenue === 0 && masterTransitions === 0,
  ));
});

test("comparison metrics use the required labels, deltas, and null zero-baseline rates", () => {
  const current = totals({ pv: 200, purchases: 20, revenue: 500, masterTransitions: 5 });
  const previous = totals({ pv: 100, purchases: 10, revenue: 300, masterTransitions: 2 });
  const comparison = getComparisonMetrics(current, previous);

  assert.deepEqual(comparison.map(({ label }) => label), [
    "売上",
    "PV",
    "購入数",
    "購入率",
    "Master遷移数",
    "Master遷移率",
  ]);
  assert.deepEqual(comparison.map(({ delta }) => delta), [200, 100, 10, 0, 3, 5]);
  assert.ok(comparison.every(({ changeRate }) => changeRate !== null));

  const zeroBaseline = getComparisonMetrics(current, totals());
  assert.ok(zeroBaseline.every(({ changeRate }) => changeRate === null));
});

test("getTopArticles sorts by key, breaks ties by revenue, limits to five, and does not mutate", () => {
  const input = [
    article("tie-low-revenue", { pv: 20, revenue: 10 }),
    article("lower-pv", { pv: 5, revenue: 100 }),
    article("tie-high-revenue", { pv: 20, revenue: 30 }),
    article("third", { pv: 15, revenue: 0 }),
    article("fourth", { pv: 10, revenue: 0 }),
    article("fifth", { pv: 8, revenue: 0 }),
    article("sixth", { pv: 7, revenue: 0 }),
  ];
  const original = [...input];
  const result = getTopArticles(input, "pv");

  assert.deepEqual(result.map(({ articleId }) => articleId), [
    "tie-high-revenue",
    "tie-low-revenue",
    "third",
    "fourth",
    "fifth",
  ]);
  assert.equal(result.length, 5);
  assert.deepEqual(input, original);
});

test("getTopArticlesByPurchaseRate filters low PV, sorts by rate then PV, and limits to five", () => {
  const input = [
    article("low-pv-high-rate", { pv: 9, purchases: 9 }),
    article("rate-20-small-pv", { pv: 20, purchases: 4 }),
    article("rate-20-large-pv", { pv: 40, purchases: 8 }),
    article("rate-10", { pv: 100, purchases: 10 }),
    article("rate-5", { pv: 100, purchases: 5 }),
    article("rate-4", { pv: 100, purchases: 4 }),
    article("rate-3", { pv: 100, purchases: 3 }),
    article("rate-2", { pv: 100, purchases: 2 }),
  ];
  const result = getTopArticlesByPurchaseRate(input);

  assert.deepEqual(result.map(({ articleId }) => articleId), [
    "rate-20-large-pv",
    "rate-20-small-pv",
    "rate-10",
    "rate-5",
    "rate-4",
  ]);
  assert.equal(result.length, 5);
});

test("getImprovementArticles enforces inclusion, priority, score, ordering, and limit boundaries", () => {
  const input = [
    article("below-pv", { pv: 99, purchases: 0 }),
    article("exact-pv-high", { pv: 100, purchases: 4 }),
    article("rate-five", { pv: 200, purchases: 10 }),
    article("rate-ten-excluded", { pv: 200, purchases: 20 }),
    article("highest-score", { pv: 500, purchases: 0 }),
    article("next-score", { pv: 400, purchases: 0 }),
    article("third-score", { pv: 300, purchases: 0 }),
  ];
  const result = getImprovementArticles(input);

  assert.deepEqual(result.map(({ articleId }) => articleId), [
    "highest-score",
    "next-score",
    "third-score",
    "rate-five",
    "exact-pv-high",
  ]);
  assert.equal(result.length, 5);

  const exactPv = result.find(({ articleId }) => articleId === "exact-pv-high");
  assert.ok(exactPv);
  assert.equal(exactPv.priority, "高");
  assert.equal(exactPv.score, 600);
  const fivePercent = result.find(({ articleId }) => articleId === "rate-five");
  assert.ok(fivePercent);
  assert.equal(fivePercent.priority, "中");
  assert.equal(fivePercent.score, 1000);
  assert.ok(!result.some(({ articleId }) => ["below-pv", "rate-ten-excluded", "sixth-score"].includes(articleId)));
});
