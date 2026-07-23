# Data Quality Report: note Data Layer v1.0

Date: 2026-07-23
Basis: input files only

## Validation Summary

- CSV syntax: passed
- JSON syntax: passed
- Uniqueness validation: passed
- Numeric validation: passed
- Date validation: passed for explicit ISO dates/months; article publication dates are missing
- Reference integrity: passed for populated article references; unresolved metric rows are marked
- Privacy scan: passed

## Record Counts

- articles: 89
- article_metrics: 11
- sales_contents: 0
- monthly_records: 7
- transactions: Missing Data
- gross_sales_jpy: 200096 for processed monthly sales visible in the sales dashboard

## Missing Data

- Original sales CSV bodies are not embedded in note_sales_history_compiled.docx.zip.
- Transaction-level sales rows cannot be reconstructed from the provided inputs.
- Purchaser names and transaction IDs were intentionally not imported or stored.
- Content-level sales counts, refunds, and net revenue cannot be reconstructed from screenshots alone.
- Most article publication dates are shown only as relative UI labels or are unavailable.
- Six article metric rows from the PV screenshot could not be resolved to an article_id with high confidence.
- Monthly current July 2026 sales amount is visible as an in-progress dashboard total but is not included in processed monthly records.
