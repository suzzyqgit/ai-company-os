---
title: "Snapshot Feed Contract"
version: "v1.0"
status: "Approved"
repository_reference_id: "ODS-SNAPSHOT-FEED-CONTRACT-v1.0"
repository: "suzzyqgit/ai-company-os"
branch: "feature/note-os"
document_type: "Read Contract"
domain: "Operational Data Layer"
created_at: "2026-07-23"
approved_at: "2026-07-23"
owner: "AI Company OS Governance"
---

# Snapshot Feed Contract v1.0

Snapshot Feed Contract v1.0 defines how Data Layer, Knowledge Layer, and Agent API consumers read approved and review-pending snapshots.

## Query Inputs

- `domain`
- `snapshotType`
- `status`
- `cursor`
- `limit`

## Output Fields

- `id`
- `domain`
- `snapshotType`
- `periodStart`
- `periodEnd`
- `observedAt`
- `confidence`
- `status`
- `validationStatus`
- `data`
- `evidence`
- `source`
- `importRun`

## Ordering

Feed results must be stable and newest-first:

1. `observedAt` descending
2. `createdAt` descending
3. `id` ascending

## Approval Boundary

Consumers must distinguish:

- `approved`
- `review_required`
- `rejected`

Only approved snapshots may be consumed as operational facts without human review.

## Runtime Contract

Executable TypeScript read contract is registered in:

- `features/imports/import-pipeline/snapshot-feed.ts`

## Change History

| Version | Date | Status | Summary |
| --- | --- | --- | --- |
| v1.0 | 2026-07-23 | Approved | Initial snapshot feed read contract. |
