export type ReadinessStatus = "READY" | "PARTIAL" | "BLOCKED" | "EMPTY";

export type ExecutiveArea =
  | "Import Layer"
  | "Data Layer"
  | "Product Layer"
  | "Revenue Operations"
  | "Knowledge Layer"
  | "Agent Communication";

export type OwnerActionPriority = "P0" | "P1" | "P2" | "P3";

export type OwnerActionItem = {
  priority: OwnerActionPriority;
  assignee: string;
  action: string;
  reason: string;
  expectedOutcome: string;
  blockingDependency: string;
};

export type ReadinessItem = {
  area: ExecutiveArea;
  status: ReadinessStatus;
  evidence: string;
  missingCondition: string;
};

export type BlockingIssue = {
  area: ExecutiveArea | "Case";
  status: ReadinessStatus;
  cause: string;
  impact: string;
  resolution: string;
  responsibleRole: string;
};

export type CurrentCaseStatus = {
  caseId: string;
  currentPhase: string;
  status: ReadinessStatus;
  blockedBy: string;
  nextGate: string;
  ownerDecisionRequired: string;
};

export type ExecutiveWorkflowInput = {
  importRunCount: number;
  importSourceCount: number;
  canonicalSalesRecordCount: number;
  pendingCanonicalSalesRecordCount: number;
  approvedCanonicalSalesRecordCount: number;
  productCount: number;
  saleCount: number;
  saleItemCount: number;
  promotionRunCount: number;
  articleCount: number;
  articleDailyMetricCount: number;
  revenueTaskCount: number;
  openRevenueTaskCount: number;
  agentRegistryCount: number;
  conversationCount: number;
  agentMessageCount: number;
  governanceDocumentCount: number;
  staticArticleCount: number;
  staticArticleMetricCount: number;
  staticMonthlySalesCount: number;
};

function pluralizeCount(count: number, label: string) {
  return `${count.toLocaleString("ja-JP")} ${label}`;
}

function hasDataLayerRecords(input: ExecutiveWorkflowInput) {
  return input.saleCount > 0 || input.saleItemCount > 0 || input.promotionRunCount > 0;
}

export function buildReadinessItems(
  input: ExecutiveWorkflowInput,
): ReadinessItem[] {
  const importLayerStatus: ReadinessStatus =
    input.importRunCount === 0 || input.importSourceCount === 0
      ? "EMPTY"
      : input.canonicalSalesRecordCount === 0
        ? "PARTIAL"
        : input.pendingCanonicalSalesRecordCount > 0
          ? "PARTIAL"
          : "READY";

  const dataLayerStatus: ReadinessStatus = hasDataLayerRecords(input)
    ? "READY"
    : input.canonicalSalesRecordCount > 0
      ? "BLOCKED"
      : "EMPTY";

  const productLayerStatus: ReadinessStatus =
    input.productCount > 0
      ? "READY"
      : input.canonicalSalesRecordCount > 0
        ? "BLOCKED"
        : "EMPTY";

  const revenueStatus: ReadinessStatus =
    input.revenueTaskCount > 0
      ? input.openRevenueTaskCount > 0
        ? "PARTIAL"
        : "READY"
      : "EMPTY";

  const knowledgeStatus: ReadinessStatus =
    input.governanceDocumentCount > 0 &&
    input.staticArticleCount > 0 &&
    input.staticMonthlySalesCount > 0
      ? "READY"
      : input.governanceDocumentCount > 0 ||
          input.staticArticleCount > 0 ||
          input.staticMonthlySalesCount > 0
        ? "PARTIAL"
        : "EMPTY";

  const agentStatus: ReadinessStatus =
    input.agentRegistryCount > 0
      ? input.conversationCount > 0 || input.agentMessageCount > 0
        ? "READY"
        : "PARTIAL"
      : "EMPTY";

  return [
    {
      area: "Import Layer",
      status: importLayerStatus,
      evidence: `${pluralizeCount(input.importRunCount, "ImportRun")} / ${pluralizeCount(
        input.importSourceCount,
        "ImportSource",
      )} / ${pluralizeCount(input.canonicalSalesRecordCount, "CanonicalSalesRecord")}`,
      missingCondition:
        input.pendingCanonicalSalesRecordCount > 0
          ? `${pluralizeCount(input.pendingCanonicalSalesRecordCount, "pending records")} require approval or review.`
          : "No missing import condition detected.",
    },
    {
      area: "Data Layer",
      status: dataLayerStatus,
      evidence: `${pluralizeCount(input.saleCount, "Sale")} / ${pluralizeCount(
        input.saleItemCount,
        "SaleItem",
      )} / ${pluralizeCount(input.promotionRunCount, "PromotionRun")}`,
      missingCondition: hasDataLayerRecords(input)
        ? "Sales promotion has produced Data Layer records."
        : "Promotion has not written Product, Sale, SaleItem, or PromotionRun records.",
    },
    {
      area: "Product Layer",
      status: productLayerStatus,
      evidence: `${pluralizeCount(input.productCount, "Product")} / ${pluralizeCount(
        input.articleCount,
        "Article records in app DB",
      )}`,
      missingCondition:
        input.productCount === 0
          ? "Product Master is not initialized."
          : "Product Master has records.",
    },
    {
      area: "Revenue Operations",
      status: revenueStatus,
      evidence: `${pluralizeCount(input.revenueTaskCount, "RevenueTask")} / ${pluralizeCount(
        input.openRevenueTaskCount,
        "open tasks",
      )}`,
      missingCondition:
        input.revenueTaskCount === 0
          ? "Revenue operation tasks have not started."
          : "Revenue operation tasks are available.",
    },
    {
      area: "Knowledge Layer",
      status: knowledgeStatus,
      evidence: `${pluralizeCount(input.governanceDocumentCount, "governance docs")} / ${pluralizeCount(
        input.staticArticleCount,
        "static articles",
      )} / ${pluralizeCount(input.staticMonthlySalesCount, "monthly sales rows")}`,
      missingCondition:
        knowledgeStatus === "READY"
          ? "Approved static knowledge and note data are available."
          : "Approved knowledge or static note data is incomplete.",
    },
    {
      area: "Agent Communication",
      status: agentStatus,
      evidence: `${pluralizeCount(input.agentRegistryCount, "AgentRegistry")} / ${pluralizeCount(
        input.conversationCount,
        "Conversation",
      )} / ${pluralizeCount(input.agentMessageCount, "AgentMessage")}`,
      missingCondition:
        input.agentRegistryCount === 0
          ? "Agent Communication seed has not been initialized."
          : "Agent registry is initialized.",
    },
  ];
}

export function buildOwnerActionItems(
  input: ExecutiveWorkflowInput,
): OwnerActionItem[] {
  const actions: OwnerActionItem[] = [];

  if (input.productCount === 0 && input.canonicalSalesRecordCount > 0) {
    actions.push({
      priority: "P0",
      assignee: "CPO",
      action: "Initialize Product Master for sold note articles.",
      reason: "Canonical sales records exist, but Product is empty.",
      expectedOutcome: "Each approved sales record can resolve to a Product before promotion.",
      blockingDependency: "Owner-approved Article-to-Product manifest.",
    });
  }

  if (input.pendingCanonicalSalesRecordCount > 0) {
    actions.push({
      priority: "P0",
      assignee: "Owner",
      action: "Approve or review pending CanonicalSalesRecord entries.",
      reason: `${pluralizeCount(
        input.pendingCanonicalSalesRecordCount,
        "CanonicalSalesRecord",
      )} remain PENDING.`,
      expectedOutcome: "Promotion can proceed only with approved import evidence.",
      blockingDependency: "Product resolution and approval decision.",
    });
  }

  if (input.articleCount === 0) {
    actions.push({
      priority: "P1",
      assignee: "Engineering",
      action: "Connect or import the Article Master into the application DB.",
      reason: "Static article data exists, but the application Article table is empty.",
      expectedOutcome: "Revenue, Product, and Marketing workflows can reference app Article IDs.",
      blockingDependency: "Article Master mapping policy.",
    });
  }

  if (
    input.importRunCount > 0 &&
    input.canonicalSalesRecordCount > 0 &&
    !hasDataLayerRecords(input)
  ) {
    actions.push({
      priority: "P1",
      assignee: "Chief AI Architect",
      action: "Resolve Promotion blocking factors before Data Layer commit.",
      reason: "Import evidence exists, but Product, Sale, SaleItem, and PromotionRun are empty.",
      expectedOutcome: "Owner can decide whether Phase 2 Data Layer Promotion is ready.",
      blockingDependency: "Product Master, record approval, and promotion gate evidence.",
    });
  }

  if (input.revenueTaskCount === 0) {
    actions.push({
      priority: "P2",
      assignee: "CEO",
      action: "Start the first Revenue Task after Product and Article references are ready.",
      reason: "RevenueTask is empty, so Revenue Operations is not actively executing.",
      expectedOutcome: "Daily revenue improvement can flow through Today and KPI review.",
      blockingDependency: "Article/Product references and at least one approved improvement target.",
    });
  }

  if (input.agentRegistryCount === 0) {
    actions.push({
      priority: "P2",
      assignee: "Engineering",
      action: "Run the approved Agent Communication seed when operations are ready.",
      reason: "AgentRegistry is empty even though Phase A schema exists.",
      expectedOutcome: "CEO, CPO, CMO, Architecture, and Engineering agents can be referenced.",
      blockingDependency: "Owner approval to seed Agent Communication records.",
    });
  }

  return actions.sort((left, right) => {
    const priorityDiff = left.priority.localeCompare(right.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return left.assignee.localeCompare(right.assignee);
  });
}

export function buildBlockingIssues(
  input: ExecutiveWorkflowInput,
): BlockingIssue[] {
  const issues: BlockingIssue[] = [];

  if (input.productCount === 0 && input.canonicalSalesRecordCount > 0) {
    issues.push({
      area: "Product Layer",
      status: "BLOCKED",
      cause: "Product Master has not been initialized.",
      impact: "CanonicalSalesRecord cannot be promoted into Product-linked SaleItem records.",
      resolution: "Approve the Article-to-Product manifest and create Product records in a controlled step.",
      responsibleRole: "CPO",
    });
  }

  if (input.pendingCanonicalSalesRecordCount > 0) {
    issues.push({
      area: "Import Layer",
      status: "PARTIAL",
      cause: "CanonicalSalesRecord approvalStatus is still PENDING.",
      impact: "Data Layer Promotion must remain blocked until import evidence is approved.",
      resolution: "Review the 216 records and move approved evidence through the approval gate.",
      responsibleRole: "Owner",
    });
  }

  if (input.articleCount === 0) {
    issues.push({
      area: "Product Layer",
      status: "BLOCKED",
      cause: "Application Article table is empty.",
      impact: "Product, Revenue Task, and Marketing workflows cannot reliably reference articles.",
      resolution: "Connect the canonical Article Master to app Article records without inventing articles.",
      responsibleRole: "Engineering",
    });
  }

  if (
    input.importRunCount > 0 &&
    input.canonicalSalesRecordCount > 0 &&
    !hasDataLayerRecords(input)
  ) {
    issues.push({
      area: "Data Layer",
      status: "BLOCKED",
      cause: "Import evidence exists but Data Layer tables are empty.",
      impact: "CEO/CPO/CMO dashboards cannot use promoted sales facts yet.",
      resolution: "Clear Product and approval gates before executing Data Layer Promotion.",
      responsibleRole: "Chief AI Architect",
    });
  }

  if (input.revenueTaskCount === 0) {
    issues.push({
      area: "Revenue Operations",
      status: "EMPTY",
      cause: "No RevenueTask records exist.",
      impact: "Today cannot guide an active revenue execution loop from tasks to KPI review.",
      resolution: "Create the first revenue task after Article/Product references are ready.",
      responsibleRole: "CEO",
    });
  }

  if (input.agentRegistryCount === 0) {
    issues.push({
      area: "Agent Communication",
      status: "EMPTY",
      cause: "AgentRegistry has no records.",
      impact: "Role-based communication cannot be used operationally.",
      resolution: "Run the explicit Agent Communication seed after Owner approval.",
      responsibleRole: "Engineering",
    });
  }

  return issues;
}

export function buildCurrentCaseStatus(
  input: ExecutiveWorkflowInput,
): CurrentCaseStatus {
  const blockingIssues = buildBlockingIssues(input);
  const blockedBy =
    blockingIssues.length > 0
      ? blockingIssues.map((issue) => issue.area).join(", ")
      : "None";
  const status: ReadinessStatus = blockingIssues.length > 0 ? "BLOCKED" : "READY";

  return {
    caseId: "Case No.002",
    currentPhase:
      input.productCount === 0
        ? "Product Master Initialization"
        : hasDataLayerRecords(input)
          ? "Revenue Operations"
          : "Data Layer Promotion Readiness",
    status,
    blockedBy,
    nextGate:
      input.productCount === 0
        ? "Owner approval of Product Master manifest"
        : hasDataLayerRecords(input)
          ? "Revenue task execution and KPI review"
          : "Owner approval for Data Layer Promotion",
    ownerDecisionRequired:
      input.productCount === 0
        ? "Approve the Product Master initialization scope: 1 sold Article = 1 Product."
        : input.pendingCanonicalSalesRecordCount > 0
          ? "Approve or reject pending canonical sales records."
          : "Confirm whether promotion can proceed.",
  };
}
