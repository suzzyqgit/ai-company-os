import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlockingIssues,
  buildCurrentCaseStatus,
  buildOwnerActionItems,
  buildReadinessItems,
  type ExecutiveWorkflowInput,
} from "../features/executive/calculators.ts";

const currentInput: ExecutiveWorkflowInput = {
  importRunCount: 1,
  importSourceCount: 8,
  canonicalSalesRecordCount: 216,
  pendingCanonicalSalesRecordCount: 216,
  approvedCanonicalSalesRecordCount: 0,
  productCount: 0,
  saleCount: 0,
  saleItemCount: 0,
  promotionRunCount: 0,
  articleCount: 0,
  articleDailyMetricCount: 0,
  revenueTaskCount: 0,
  openRevenueTaskCount: 0,
  agentRegistryCount: 0,
  conversationCount: 0,
  agentMessageCount: 0,
  governanceDocumentCount: 8,
  staticArticleCount: 89,
  staticArticleMetricCount: 11,
  staticMonthlySalesCount: 7,
};

test("builds deterministic Owner Action Center items from current blockers", () => {
  const actions = buildOwnerActionItems(currentInput);

  assert.deepEqual(
    actions.map((action) => `${action.priority}:${action.assignee}`),
    ["P0:CPO", "P0:Owner", "P1:Chief AI Architect", "P1:Engineering", "P2:CEO", "P2:Engineering"],
  );
  assert.match(actions[0].action, /Product Master/);
  assert.match(actions[1].reason, /216/);
});

test("marks readiness without writing Import Layer or Data Layer records", () => {
  const readiness = buildReadinessItems(currentInput);
  const byArea = new Map(readiness.map((item) => [item.area, item.status]));

  assert.equal(byArea.get("Import Layer"), "PARTIAL");
  assert.equal(byArea.get("Data Layer"), "BLOCKED");
  assert.equal(byArea.get("Product Layer"), "BLOCKED");
  assert.equal(byArea.get("Revenue Operations"), "EMPTY");
  assert.equal(byArea.get("Knowledge Layer"), "READY");
  assert.equal(byArea.get("Agent Communication"), "EMPTY");
});

test("reports blocking issues with cause, impact, resolution, and role", () => {
  const issues = buildBlockingIssues(currentInput);

  assert.ok(issues.length >= 5);
  for (const issue of issues) {
    assert.notEqual(issue.cause.trim(), "");
    assert.notEqual(issue.impact.trim(), "");
    assert.notEqual(issue.resolution.trim(), "");
    assert.notEqual(issue.responsibleRole.trim(), "");
  }
});

test("summarizes Case No.002 as blocked by existing data conditions", () => {
  const status = buildCurrentCaseStatus(currentInput);

  assert.equal(status.caseId, "Case No.002");
  assert.equal(status.currentPhase, "Product Master Initialization");
  assert.equal(status.status, "BLOCKED");
  assert.match(status.ownerDecisionRequired, /Product Master/);
});
