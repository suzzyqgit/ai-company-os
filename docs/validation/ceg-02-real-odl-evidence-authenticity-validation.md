---
artifact_id: VAL-CEG-02-REAL-ODL-001
title: CEG-02 Real ODL Evidence Authenticity Validation
version: 1.1
status: OPEN / BLOCKED
lifecycle: Validation Incomplete
artifact_type: Validation Record
owner: CEO
steward: Chief AI Architect
execution_owner: Chief Software Engineer
organization: KAVORA
operating_platform: AI Company OS
updated_at: 2026-09-02
---

# CEG-02 Real ODL Evidence Authenticity Validation

## Architecture Decision B

CEG-02 evidence resolution is bounded to the existing Sales Import canonical path:

`ImportRun -> ImportSource -> CanonicalSalesRecord`

The earlier Snapshot-only requirement was a Contract Mismatch. Snapshot mapping logic remains validated, but a Snapshot has not been demonstrated to be the canonical output of the current Sales Import Pipeline. The existing Snapshot adapter is retained without deletion or semantic change.

This correction does not introduce a generic evidence framework. Architecture Deviation: No.

## Canonical Approval Contract

Persistent approval follows this order:

1. `CanonicalSalesRecord`: current validation result must pass.
2. `ImportSource`: all required child Records must be `APPROVED` in the same transaction.
3. `ImportRun`: status must be `COMPLETED`, and all required Sources must be `APPROVED` in the same transaction.

Each transition requires a freshly recomputed deterministic fingerprint of the exact current Run, ordered Sources, ordered Records, source and import provenance, business keys, canonical content digests, validation digests and results, approval states, readiness result, and fingerprint/canonicalization versions.

A mismatch fails before any approval write. Each approved object preserves the pre-transition fingerprint, decision reference, verified authority role, authority evidence digest, verifier identity, reviewer identity, review time, and reason.

The approved schema contract uses the existing six nullable approval audit fields only. `approvalFingerprintVersion` stores an immutable Approval Fingerprint Contract Version, not a free-standing implementation revision. Contract `sales-import-approval-sha256-canonical-json-v1` uniquely binds SHA-256 to `sales-import-approval-canonical-json-v1`; algorithm and canonicalization version are also explicit in the canonical fingerprint input.

`approvalVerifierId` is an immutable, versioned verifier implementation identifier using the `name-vN` form. It is accepted only from the authority verifier, persisted on the first successful transition, and not rewritten by idempotent re-entry.

## Authority Boundary

CEO is the approval authority. Caller-provided role names, reviewer names, booleans, and arbitrary decision references are not authorization.

The bounded lifecycle accepts an authority verifier supplied by trusted runtime composition. Isolated tests use a fixture verifier with an explicit decision-to-target-and-fingerprint binding. No trustworthy production runtime CEO identity/evidence binding currently exists, so the production verifier remains unavailable and fails closed.

`RUNTIME CEO AUTHORITY BINDING: UNRESOLVED`

## Validation Evidence

- Isolated bounded lifecycle tests: 16 cases PASS
- Existing Sales Import Ledger regression: 6 cases PASS
- Fingerprint mismatch: zero approval writes
- Caller-forged CEO role: rejected
- Caller-forged decision reference: rejected
- Unversioned verifier identity: rejected with zero approval writes
- Record validation failure: rejected
- Partial Record approval: allowed
- Source and Run child gates: fail closed
- Source and Run transition atomicity: PASS
- Repeated invocation/idempotency: PASS
- Audit evidence completeness: PASS
- `Sale`, `SaleItem`, `PromotionRun`, and unrelated ODL mutation: none in isolated fixtures

Repository-wide validation results are reported with the implementation evidence package and are not inferred by this artifact.

## Real ODL Boundary

- Real ODL Record approvals: Not Executed
- Real ODL Source approvals: Not Executed
- Real ODL Run approval: Not Executed
- Real ODL writes: 0
- Data Layer Promotion: Not Executed
- Production rollout: Not Executed
- `main` merge: Not Executed

Existing real ODL records remain in their current approval states. This implementation does not make an ineligible record eligible and does not claim real evidence authenticity.

## Closure Boundary

CEG-02 remains open. Chief Software Engineer does not declare closure. CEO Closure Review is required after evaluation of the implementation evidence package and any separately authorized real evidence validation.
