---
title: "Source Metadata Standard"
version: "v1.0"
status: "Approved"
repository_reference_id: "ODS-SOURCE-METADATA-STD-v1.0"
repository: "suzzyqgit/ai-company-os"
branch: "feature/note-os"
document_type: "Metadata Standard"
domain: "Operational Data Layer"
created_at: "2026-07-23"
approved_at: "2026-07-23"
owner: "AI Company OS Governance"
---

# Source Metadata Standard v1.0

Source Metadata Standard v1.0 defines the minimum metadata required for every Import Source.

## Required Fields

- `sourceType`
- `sourceFile`
- `sourceHash`
- `importedAt`
- `importedBy`
- `parserVersion`
- `confidence`
- `inspection`

`sourceHash` must be SHA-256.

## Inspection Metadata

Image sources must record:

- MIME
- file signature
- file size
- width
- height

CSV sources must record:

- encoding
- UTF-8 BOM presence
- header count
- row count
- row widths
- schema compatibility

## Privacy Rule

Source metadata must not store purchaser names, transaction IDs, registration numbers, or other personal identifiers. SourceHash is permitted for audit and duplicate detection.

## Runtime Contract

Executable TypeScript types and validators are registered in:

- `features/imports/import-pipeline/output-schema.ts`

The runtime validator is:

- `validateSourceMetadata`

## Change History

| Version | Date | Status | Summary |
| --- | --- | --- | --- |
| v1.0 | 2026-07-23 | Approved | Initial business-common source metadata standard. |
