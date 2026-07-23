---
title: "Pipeline Persistence Contract"
version: "v1.0"
status: "Approved"
repository_reference_id: "ODS-PIPELINE-PERSISTENCE-CONTRACT-v1.0"
repository: "suzzyqgit/ai-company-os"
branch: "feature/note-os"
document_type: "Persistence Contract"
domain: "Operational Data Layer"
created_at: "2026-07-23"
approved_at: "2026-07-23"
owner: "AI Company OS Governance"
---

# Pipeline Persistence Contract v1.0

Pipeline Persistence Contract v1.0 defines the business-common persistence boundary for import pipelines.

## Pipeline

```text
Source -> Inspect -> Classify -> Extract -> Normalize -> Validate -> Persist -> Snapshot Feed
```

OCR is one Extract implementation. The persistence contract is not OCR-specific.

## Models

- `ImportRun`
- `ImportSource`
- `Snapshot`

## Duplicate SourceHash Rule

`ImportSource.sourceHash` is indexed, not globally unique.

Reason:

- audit reruns must be preserved
- duplicate operational reflection must be prevented

If an approved snapshot already exists for the same SourceHash, a later approved snapshot for that SourceHash must be downgraded to `review_required` by the persistence layer.

## Failure Audit Rule

Failed runs must be saved with:

- `ImportRun.status = failed`
- `ImportSource`
- error or validation summary

Failed validation must not create approved snapshots.

## Article.pv Safety Rule

Period snapshots must not update `Article.pv`. `Article.pv` remains a separate operational decision and may only be updated through an approved `ALL_TIME` cumulative path.

## Runtime Contract

Executable TypeScript persistence contract is registered in:

- `features/imports/import-pipeline/persistence.ts`

## Change History

| Version | Date | Status | Summary |
| --- | --- | --- | --- |
| v1.0 | 2026-07-23 | Approved | Initial business-common import persistence contract. |
