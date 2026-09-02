---
artifact_id: VAL-CEG-02-REAL-ODL-001
title: CEG-02 Real ODL Evidence Authenticity Validation
version: 1.2
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
3. `ImportRun`: persisted status must be exactly `completed`, and all required Sources must be `APPROVED` in the same transaction.

The canonical persistent `ImportRun.status` values are exactly `completed`, `failed`, and `review_required`. No case or whitespace normalization is permitted. `COMPLETED` and `REVIEW_REQUIRED` remain DRY_RUN report-local readiness vocabulary and are not interpreted as persistent status values.

Each transition requires a freshly recomputed deterministic fingerprint of the exact current Run, ordered Sources, ordered Records, source and import provenance, business keys, canonical content digests, validation digests and results, approval states, readiness result, and fingerprint/canonicalization versions.

A mismatch fails before any approval write. Each approved object preserves the pre-transition fingerprint, decision reference, verified authority role, authority evidence digest, verifier identity, reviewer identity, review time, and reason.

The approved schema contract uses the existing six nullable approval audit fields only. `approvalFingerprintVersion` stores an immutable Approval Fingerprint Contract Version, not a free-standing implementation revision. Current contract `sales-import-approval-sha256-canonical-json-v2` uniquely binds SHA-256, deterministic `sales-import-approval-canonical-json-v2` canonicalization, exact lowercase persistent Run-status semantics, and corrected readiness interpretation. Algorithm, canonicalization version, persistent status contract, and readiness contract version are explicit in the canonical fingerprint input. The v1 identifier may be recognized as historical pre-correction evidence but cannot authorize a new approval transition.

`approvalVerifierId` is an immutable, versioned verifier implementation identifier using the `name-vN` form. It is accepted only from the authority verifier, persisted on the first successful transition, and not rewritten by idempotent re-entry.

## Authority Boundary

CEO is the approval authority. Caller-provided role names, reviewer names, booleans, and arbitrary decision references are not authorization.

The bounded lifecycle accepts an authority verifier supplied by trusted runtime composition. Isolated tests use a fixture verifier with an explicit decision-to-target-and-fingerprint binding. No trustworthy production runtime CEO identity/evidence binding currently exists, so the production verifier remains unavailable and fails closed.

`RUNTIME CEO AUTHORITY BINDING: UNRESOLVED`

## Validation Evidence

- Isolated bounded lifecycle tests: 21 cases PASS
- Existing Sales Import Ledger regression: 6 cases PASS
- Persistent `completed`, `failed`, `review_required`, and noncanonical `COMPLETED` gates: PASS
- Approval Fingerprint Contract v1 as new authorization input: rejected with zero approval writes
- Data Layer Promotion persistent status predicate: exact `completed` accepted; `COMPLETED` rejected
- DRY_RUN report-local `COMPLETED` with zero persistent writes: preserved
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

- Fresh read-only v2 fingerprint: `1ac00d3f8c72f1753c11e8abddcbd2054334a807828f99f514ea6338cc8cc1ae`
- Historical pre-correction v1 fingerprint reference: `0ba3fb09c6a206eed802b6c0506ab5299a68b2134b35bdc75c5880051a958bbd`
- ImportRun: `cmryhc9n70000bh8bgi7brnnr`, raw status `completed`, approval status `PENDING`
- Population: 8 Sources and 216 Canonical Sales Records
- Approval distribution: Sources `PENDING` 8; Records `PENDING` 216
- Readiness: `runCompleted=true`, `lifecycleEligible=true`, `readyForSourceApproval=false`, `readyForRunApproval=false`, `readyForDataLayerPromotion=false`
- Validation and traceability: PASS; source hash, parser provenance, and import provenance mismatches: 0
- Prior DRY_RUN comparison: source and record populations, validation, and traceability remain aligned. DRY_RUN's in-memory `COMPLETED / APPROVED` vocabulary is not persistent approval evidence; real persistent approval states remain `PENDING`.
- Read-only collection DB SHA-256 before and after: `5cea317e26749d8f0195106a55d46503b24b49111ff6ed6fec0f42b9dd75b72e` (match)
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
