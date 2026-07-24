# Phase 2 Data Layer Promotion Implementation Report

## Scope

Phase 2 implements the controlled promotion boundary from approved Import Ledger
records into Business Data Layer entities. It does not implement analysis,
dashboards, KPI calculation, Snapshot mutation, OCR changes, Knowledge Layer, or
Agent API behavior.

## Data Layer

- `Product` is the business product master.
- `Article` may reference one `Product`; an Article is not itself the product master.
- `Sale` stores the commercial event and uniquely inherits the Import Ledger
  `businessKey` and `importLedgerId`.
- `SaleItem` links a Sale to an Owner-confirmed Product.
- `PromotionRun` records every successful or failed COMMIT attempt, including the
  exact approved fingerprint and Owner authorization evidence.

## Promotion controls

1. The ImportRun must be completed and approved.
2. The source and every promoted CanonicalSalesRecord must be approved.
3. Every record requires an explicit Owner-confirmed Product resolution.
4. The current input fingerprint must equal the Owner-approved fingerprint.
5. Sale, SaleItem, and successful PromotionRun writes share one transaction.
6. A partial error rolls back all business rows; a separate failed PromotionRun
   audit records that rollback.
7. `businessKey` and `importLedgerId` uniqueness make re-execution idempotent.

## Verification contract

Before COMMIT, the plan reports CanonicalSalesRecord count, gross total, and net
total. After COMMIT, these must equal Sale count, SaleItem count, gross total, and
net total. Tests cover success, re-execution, rollback, and authorization failure.

## Execution status

The COMMIT capability is implemented but has not been run against the 216 real
records. Product creation, record-to-Product resolution, CEO approval, and a new
Owner approval of the exact fingerprint are required before execution.
