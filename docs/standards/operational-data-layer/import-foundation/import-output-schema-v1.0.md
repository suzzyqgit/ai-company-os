---
title: "Import Output Schema"
version: "v1.0"
status: "Approved"
repository_reference_id: "ODS-IMPORT-OUTPUT-SCHEMA-v1.0"
repository: "suzzyqgit/ai-company-os"
branch: "feature/note-os"
document_type: "Schema Contract"
domain: "Operational Data Layer"
created_at: "2026-07-23"
approved_at: "2026-07-23"
owner: "AI Company OS Governance"
---

# Import Output Schema v1.0

Import Output Schema v1.0 is the business-common output contract for import pipelines in AI Company OS.

## Scope

The contract covers:

- Import run metadata
- Source metadata
- Classification result
- Extraction result
- Normalized records
- Validation result
- Snapshots
- Evidence
- Errors and warnings

Domain payloads must be represented as typed JSON records. Implementations must not depend on unbounded `any` payloads.

## Runtime Contract

Executable TypeScript types and validators are registered in:

- `features/imports/import-pipeline/output-schema.ts`

The runtime validator is:

- `validateImportOutput`

## Required Top-Level Fields

- `schemaVersion`
- `importRun`
- `importSource`
- `classification`
- `extraction`
- `normalizedRecords`
- `validation`
- `snapshots`
- `evidence`
- `errors`
- `warnings`

## Safety Rules

- Unknown periods must not be converted to `ALL_TIME`.
- Unresolved values must remain `null` or be marked unresolved.
- Validation failures must not be saved as approved snapshots.
- Personal identifiers must not be written to output payloads.

## Change History

| Version | Date | Status | Summary |
| --- | --- | --- | --- |
| v1.0 | 2026-07-23 | Approved | Initial business-common import output contract. |
