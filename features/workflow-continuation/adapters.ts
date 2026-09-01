import type { PrismaClient } from "@prisma/client";
import {
  OWNER_DECISION_ROUTE,
  ROUTINE_ONLY_ROUTE,
  ROUTINE_TRANSITION,
  type AuthorityFixture,
  type DecisionAuthority,
  type EvidenceFixture,
} from "./contracts.ts";

export interface EvidenceGateDecision {
  outcome: "PASS" | "BLOCK";
  reason: string | null;
  evidenceReference: string | null;
}

export interface EvidenceGateAdapter {
  evaluate(evidence: EvidenceFixture): EvidenceGateDecision;
}

export class FixtureEvidenceGateAdapter implements EvidenceGateAdapter {
  evaluate(evidence: EvidenceFixture): EvidenceGateDecision {
    if (evidence.status === "MISSING" || evidence.reference.trim() === "") {
      return {
        outcome: "BLOCK",
        reason: "evidence_missing",
        evidenceReference: null,
      };
    }

    if (evidence.status !== "CONFIRMED") {
      return {
        outcome: "BLOCK",
        reason: "evidence_unverified",
        evidenceReference: evidence.reference,
      };
    }

    if (evidence.source !== "OPERATIONAL_DATA_LAYER_ADAPTER_FIXTURE") {
      return {
        outcome: "BLOCK",
        reason: "evidence_source_not_authorized",
        evidenceReference: evidence.reference,
      };
    }

    return {
      outcome: "PASS",
      reason: null,
      evidenceReference: evidence.reference,
    };
  }
}

interface AuthorityPolicy {
  actorRole: string;
  requestedTransition: string;
  decisionAuthority: DecisionAuthority;
}

const AUTHORITY_POLICIES: Readonly<Record<string, AuthorityPolicy>> =
  Object.freeze({
    [OWNER_DECISION_ROUTE]: Object.freeze({
      actorRole: "CEO",
      requestedTransition: ROUTINE_TRANSITION,
      decisionAuthority: "OWNER_ONLY",
    }),
    [ROUTINE_ONLY_ROUTE]: Object.freeze({
      actorRole: "CEO",
      requestedTransition: ROUTINE_TRANSITION,
      decisionAuthority: "CEO",
    }),
  });

export interface AuthorityRouteDecision {
  outcome: "AUTHORIZED" | "BLOCK";
  reason: string | null;
  decisionAuthority: DecisionAuthority;
}

export interface AuthorityRouter {
  route(fixture: AuthorityFixture): AuthorityRouteDecision;
}

export class DeterministicAuthorityRouter implements AuthorityRouter {
  route(fixture: AuthorityFixture): AuthorityRouteDecision {
    const policy = AUTHORITY_POLICIES[fixture.routeKey];

    if (!policy) {
      return {
        outcome: "BLOCK",
        reason: "route_not_authorized",
        decisionAuthority: "UNRESOLVED",
      };
    }

    if (fixture.actorRole !== policy.actorRole) {
      return {
        outcome: "BLOCK",
        reason: "actor_role_not_authorized",
        decisionAuthority: "UNRESOLVED",
      };
    }

    if (fixture.requestedTransition !== policy.requestedTransition) {
      return {
        outcome: "BLOCK",
        reason: "transition_not_authorized",
        decisionAuthority: "UNRESOLVED",
      };
    }

    return {
      outcome: "AUTHORIZED",
      reason: null,
      decisionAuthority: policy.decisionAuthority,
    };
  }
}

export interface SideEffectRecordInput {
  idempotencyKey: string;
  threadId: string;
  workflowRunId: string;
  step: string;
  payload: Record<string, unknown>;
}

export class SqliteSideEffectLedger {
  readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async initialize(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS kavora_workflow_poc_side_effects (
        idempotency_key TEXT PRIMARY KEY NOT NULL,
        thread_id TEXT NOT NULL,
        workflow_run_id TEXT NOT NULL,
        step TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  }

  async record(input: SideEffectRecordInput): Promise<"APPLIED" | "DUPLICATE"> {
    const affectedRows = await this.prisma.$executeRawUnsafe(
      `
        INSERT OR IGNORE INTO kavora_workflow_poc_side_effects (
          idempotency_key,
          thread_id,
          workflow_run_id,
          step,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      input.idempotencyKey,
      input.threadId,
      input.workflowRunId,
      input.step,
      JSON.stringify(input.payload),
      new Date().toISOString(),
    );

    return affectedRows === 1 ? "APPLIED" : "DUPLICATE";
  }

  async countByKey(idempotencyKey: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `
        SELECT COUNT(*) AS count
        FROM kavora_workflow_poc_side_effects
        WHERE idempotency_key = ?
      `,
      idempotencyKey,
    );

    return Number(rows[0]?.count ?? 0);
  }
}
