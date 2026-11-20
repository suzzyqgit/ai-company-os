import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  RevenueReviewEvidence,
  RevenueReviewQueueItem,
} from "../features/revenue/review.ts";
import {
  buildRevenueReviewRecommendation,
  compareRevenueReviewRecommendations,
  deduplicateRevenueReviewRecommendations,
  type RevenueReviewRecommendation,
  type RevenueReviewRecommendationType,
} from "../features/revenue/recommendations.ts";

const defaultEvidence: RevenueReviewEvidence = {
  before: { pv: 20, purchases: 2, revenue: 200, metricDays: 7 },
  after: { pv: 22, purchases: 2, revenue: 200, metricDays: 7 },
  delta: { pv: 2, purchases: 0, revenue: 0, revenueRate: 0 },
};

function makeReviewItem(
  overrides: Partial<RevenueReviewQueueItem> = {},
): RevenueReviewQueueItem {
  return {
    taskId: "task-1",
    taskTitle: "Improve article",
    taskType: "GENERAL",
    priority: 3,
    articleId: "article-1",
    articleTitle: "Article one",
    completedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2025-12-20T00:00:00.000Z"),
    daysSinceCompletion: 7,
    beforePeriod: "2025-12-25〜2025-12-31",
    afterPeriod: "2026-01-01〜2026-01-07",
    phase: "REVIEW_READY",
    result: "NO_POSITIVE_SIGNAL",
    nextAction: "RETRY",
    evidence: defaultEvidence,
    ...overrides,
  };
}

function makeRecommendation(
  overrides: Partial<RevenueReviewRecommendation> &
    Pick<RevenueReviewRecommendation, "taskId" | "recommendationType">,
): RevenueReviewRecommendation {
  const { taskId, recommendationType, ...otherOverrides } = overrides;

  return {
    taskId,
    taskTitle: "Improve article",
    articleId: "article-1",
    articleTitle: "Article one",
    recommendationType,
    priority: 3,
    reason: "Test reason",
    recommendedAction: "Test action",
    sourceResult: "NO_POSITIVE_SIGNAL",
    revenueDelta: 0,
    pvDelta: 0,
    purchasesDelta: 0,
    completedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...otherOverrides,
  };
}

function recommendationType(item: RevenueReviewQueueItem) {
  return buildRevenueReviewRecommendation(item)?.recommendationType;
}

test("buildRevenueReviewRecommendation returns null while measuring", () => {
  assert.equal(
    buildRevenueReviewRecommendation(
      makeReviewItem({ phase: "MEASURING", result: "POSITIVE_SIGNAL" }),
    ),
    null,
  );
});

test("buildRevenueReviewRecommendation returns null without a result", () => {
  assert.equal(
    buildRevenueReviewRecommendation(makeReviewItem({ phase: "REVIEW_READY", result: null })),
    null,
  );
});

test("POSITIVE_SIGNAL produces CONTINUE_WINNER and copies source fields", () => {
  const item = makeReviewItem({
    taskId: "task-positive",
    priority: 8,
    evidence: {
      ...defaultEvidence,
      delta: { pv: 9, purchases: 4, revenue: 125, revenueRate: 62.5 },
    },
    completedAt: new Date("2026-03-04T12:30:00.000Z"),
    result: "POSITIVE_SIGNAL",
  });
  const recommendation = buildRevenueReviewRecommendation(item);

  assert.ok(recommendation);
  assert.equal(recommendation.recommendationType, "CONTINUE_WINNER");
  assert.equal(recommendation.taskId, item.taskId);
  assert.equal(recommendation.priority, item.priority);
  assert.equal(recommendation.pvDelta, item.evidence.delta.pv);
  assert.equal(recommendation.purchasesDelta, item.evidence.delta.purchases);
  assert.equal(recommendation.revenueDelta, item.evidence.delta.revenue);
  assert.equal(recommendation.completedAt, item.completedAt);
});

test("INSUFFICIENT_DATA produces COLLECT_MORE_DATA", () => {
  assert.equal(
    recommendationType(makeReviewItem({ result: "INSUFFICIENT_DATA" })),
    "COLLECT_MORE_DATA",
  );
});

test("NO_POSITIVE_SIGNAL with a negative PV delta produces RETRY_TRAFFIC", () => {
  const evidence = { ...defaultEvidence, delta: { ...defaultEvidence.delta, pv: -1 } };
  assert.equal(recommendationType(makeReviewItem({ result: "NO_POSITIVE_SIGNAL", evidence })), "RETRY_TRAFFIC");
});

test("NO_POSITIVE_SIGNAL with nonnegative PV and negative purchases produces RETRY_CTA", () => {
  const evidence = {
    ...defaultEvidence,
    delta: { ...defaultEvidence.delta, pv: 1, purchases: -1 },
  };
  assert.equal(recommendationType(makeReviewItem({ result: "NO_POSITIVE_SIGNAL", evidence })), "RETRY_CTA");
});

test("NO_POSITIVE_SIGNAL with nonnegative PV and purchases produces RETRY_OFFER", () => {
  const evidence = {
    ...defaultEvidence,
    delta: { ...defaultEvidence.delta, pv: 1, purchases: 0 },
  };
  assert.equal(recommendationType(makeReviewItem({ result: "NO_POSITIVE_SIGNAL", evidence })), "RETRY_OFFER");
});

test("zero PV does not trigger RETRY_TRAFFIC and zero purchases does not trigger RETRY_CTA", () => {
  const evidence = {
    ...defaultEvidence,
    delta: { ...defaultEvidence.delta, pv: 0, purchases: 0 },
  };
  assert.equal(recommendationType(makeReviewItem({ result: "NO_POSITIVE_SIGNAL", evidence })), "RETRY_OFFER");
});

test("negative PV takes precedence when purchases are also negative", () => {
  const evidence = {
    ...defaultEvidence,
    delta: { ...defaultEvidence.delta, pv: -1, purchases: -1 },
  };
  assert.equal(recommendationType(makeReviewItem({ result: "NO_POSITIVE_SIGNAL", evidence })), "RETRY_TRAFFIC");
});

test("urgency rank orders RETRY_CTA, RETRY_OFFER, RETRY_TRAFFIC, CONTINUE_WINNER, COLLECT_MORE_DATA, NO_ACTION", () => {
  const types: RevenueReviewRecommendationType[] = [
    "RETRY_CTA",
    "RETRY_OFFER",
    "RETRY_TRAFFIC",
    "CONTINUE_WINNER",
    "COLLECT_MORE_DATA",
    "NO_ACTION",
  ];

  for (let index = 0; index < types.length - 1; index += 1) {
    assert.ok(
      compareRevenueReviewRecommendations(
        makeRecommendation({ taskId: `task-${index}`, recommendationType: types[index]! }),
        makeRecommendation({ taskId: `task-${index + 1}`, recommendationType: types[index + 1]! }),
      ) < 0,
    );
  }
});

test("same recommendation type sorts higher priority first", () => {
  assert.ok(
    compareRevenueReviewRecommendations(
      makeRecommendation({ taskId: "high", recommendationType: "RETRY_CTA", priority: 8 }),
      makeRecommendation({ taskId: "low", recommendationType: "RETRY_CTA", priority: 2 }),
    ) < 0,
  );
});

test("same type and priority sorts smaller revenueDelta first", () => {
  assert.ok(
    compareRevenueReviewRecommendations(
      makeRecommendation({ taskId: "smaller", recommendationType: "RETRY_CTA", revenueDelta: -4 }),
      makeRecommendation({ taskId: "larger", recommendationType: "RETRY_CTA", revenueDelta: 3 }),
    ) < 0,
  );
});

test("same type, priority, and revenueDelta sorts later completion first", () => {
  assert.ok(
    compareRevenueReviewRecommendations(
      makeRecommendation({
        taskId: "later",
        recommendationType: "RETRY_CTA",
        completedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
      makeRecommendation({
        taskId: "earlier",
        recommendationType: "RETRY_CTA",
        completedAt: new Date("2026-03-01T00:00:00.000Z"),
      }),
    ) < 0,
  );
});

test("all equal except taskId sorts lexicographically", () => {
  assert.ok(
    compareRevenueReviewRecommendations(
      makeRecommendation({ taskId: "alpha", recommendationType: "RETRY_CTA" }),
      makeRecommendation({ taskId: "zeta", recommendationType: "RETRY_CTA" }),
    ) < 0,
  );
});

test("deduplication keeps the first sorted item for the same article and type", () => {
  const lower = makeRecommendation({
    taskId: "lower-priority",
    articleId: "shared-article",
    recommendationType: "RETRY_CTA",
    priority: 2,
  });
  const higher = makeRecommendation({
    taskId: "higher-priority",
    articleId: "shared-article",
    recommendationType: "RETRY_CTA",
    priority: 9,
  });

  assert.deepEqual(
    deduplicateRevenueReviewRecommendations([lower, higher]),
    [higher],
  );
});

test("deduplication keeps different types for the same article", () => {
  const cta = makeRecommendation({
    taskId: "cta",
    articleId: "shared-article",
    recommendationType: "RETRY_CTA",
  });
  const offer = makeRecommendation({
    taskId: "offer",
    articleId: "shared-article",
    recommendationType: "RETRY_OFFER",
  });

  assert.deepEqual(deduplicateRevenueReviewRecommendations([offer, cta]), [cta, offer]);
});

test("deduplication output follows comparator order", () => {
  const items = [
    makeRecommendation({ taskId: "offer", recommendationType: "RETRY_OFFER" }),
    makeRecommendation({ taskId: "winner", recommendationType: "CONTINUE_WINNER" }),
    makeRecommendation({ taskId: "cta", recommendationType: "RETRY_CTA" }),
  ];

  assert.deepEqual(
    deduplicateRevenueReviewRecommendations(items),
    [...items].sort(compareRevenueReviewRecommendations),
  );
});

test("deduplication output is input-order independent and does not mutate input", () => {
  const duplicateLow = makeRecommendation({
    taskId: "duplicate-low",
    articleId: "duplicate-article",
    recommendationType: "RETRY_OFFER",
    priority: 1,
  });
  const duplicateWinner = makeRecommendation({
    taskId: "duplicate-winner",
    articleId: "duplicate-article",
    recommendationType: "RETRY_OFFER",
    priority: 7,
  });
  const traffic = makeRecommendation({ taskId: "traffic", recommendationType: "RETRY_TRAFFIC" });
  const cta = makeRecommendation({ taskId: "cta", recommendationType: "RETRY_CTA" });
  const input = [duplicateLow, traffic, duplicateWinner, cta];
  const originalOrder = [...input];
  const shuffled = [cta, duplicateWinner, traffic, duplicateLow];

  const firstOutput = deduplicateRevenueReviewRecommendations(input);
  const shuffledOutput = deduplicateRevenueReviewRecommendations(shuffled);

  assert.deepEqual(firstOutput, shuffledOutput);
  assert.deepEqual(input, originalOrder);
  assert.equal(firstOutput[0]?.taskId, "cta");
  assert.equal(firstOutput[1]?.taskId, "duplicate-winner");
  assert.equal(firstOutput[2]?.taskId, "traffic");
});
