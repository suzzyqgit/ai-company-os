# Data Layer Promotion Contract v1.0

## Scope

This contract defines the Phase 2 boundary between the Import Layer and Data Layer.
Phase 1C-C implements readiness validation only and performs no promotion.

## Preconditions

- The ImportRun is completed and approved.
- Every promoted ImportSource is approved.
- Only `APPROVED` CanonicalSalesRecords are eligible.
- Candidate article and product identifiers are advisory until Phase 2 resolves them.

## Guarantees

- **Idempotency:** a promoted BusinessKey cannot be promoted twice.
- **Atomicity:** a promotion batch succeeds completely or is rolled back completely.
- **Audit inheritance:** promoted rows retain references to ImportRun, ImportSource,
  CanonicalSalesRecord, parser version, source hash, imported time and importer.
- **Promotion log:** every attempt records its fingerprint, outcome, actor, time,
  source and record counts, and failure reason.
- **Re-execution:** identical approved input produces the same fingerprint and result.
- **Isolation:** no Article, Snapshot, metric, dashboard, Knowledge Layer, AI Analysis,
  or Agent API mutation occurs during Phase 1C-C.

## Phase 2 transaction outline

1. Lock the approved ImportRun and its eligible sources.
2. Revalidate approval state and input fingerprint.
3. Resolve product/article identity.
4. Insert Data Layer rows and promotion log in one transaction.
5. On any error, roll back the complete batch.
