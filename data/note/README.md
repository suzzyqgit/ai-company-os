# note Business Data

`data/note` is the Single Source of Truth for note business data in Case No.002.

CEO, CPO, CMO, and Chief AI Architect must reference this directory when reviewing Case No.002 note business performance, recovery planning, and operational decisions.

## Data Layers

- `raw/`: Original exports and screenshots. Non-anonymized source files must not be committed.
- `sales/`: Normalized sales domain data derived from approved CSV sources.
- `articles/`: Normalized article domain data, including structured article-level metrics when available.
- `current/`: Latest approved business snapshot for shared executive reference.
- `reports/`: Generated analysis and derived reporting based on approved data.

## Data Governance

Purchaser names, transaction IDs, registration numbers, and other personal or sensitive information must not be committed to this repository.

The note sales CSV is authoritative for sales. Dashboard screenshots supplement data that is unavailable through CSV, such as access metrics and other dashboard-only values.

## Current Limitations

- Article-level PV, likes, and comments are not yet fully structured.
- Article IDs are not yet permanently mapped.
- Original non-anonymized CSV files are not committed.
