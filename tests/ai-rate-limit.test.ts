import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAiRateLimit } from "../features/ai/rate-limit-policy.ts";

const minuteMessage = "AI分析の実行回数が多すぎます。少し待ってから再実行してください。";
const dailyMessage = "本日のAI分析上限に達しました。明日以降に再実行してください。";

test("allows counts below both limits", () => {
  assert.deepEqual(evaluateAiRateLimit(0, 0), { allowed: true, message: null });
  assert.deepEqual(evaluateAiRateLimit(2, 19), { allowed: true, message: null });
});

test("rejects the minute limit", () => {
  assert.deepEqual(evaluateAiRateLimit(3, 0), { allowed: false, message: minuteMessage });
});

test("rejects the daily limit", () => {
  assert.deepEqual(evaluateAiRateLimit(0, 20), { allowed: false, message: dailyMessage });
  assert.deepEqual(evaluateAiRateLimit(2, 20), { allowed: false, message: dailyMessage });
});

test("minute limit takes precedence when both limits are reached", () => {
  assert.deepEqual(evaluateAiRateLimit(3, 25), { allowed: false, message: minuteMessage });
});
