# Article Master

This directory stores the canonical Article Master for Case No.002 note business data.

## Purpose

`articles.csv` is the canonical Article Master. Every future dataset, including PV, sales, OCR, AI analysis, and improvement datasets, must reference `article_id`.

The Article Master exists to prevent title-based ambiguity and to provide a stable reference layer for executive, product, marketing, and architecture review.

## Schema

```text
article_id,title,status,price,published_date,last_updated,tags
```

The initial file contains only the header. Articles must not be invented.

## article_id Policy

- `article_id` is the required stable identifier for every article record.
- Future datasets must reference `article_id` instead of relying on title matching alone.
- `article_id` assignment must be completed through an approved import or mapping process.
- If an article cannot be mapped safely, it must remain pending until verified.

## Future Relationships

```text
Article
 ↓
PV
 ↓
Sales
 ↓
AI Analysis
 ↓
Improvement Ideas
 ↓
CPO
 ↓
CMO
```

## Current Limitations

- Article records are not yet imported.
- Article IDs are not yet permanently mapped.
- Article-level PV, likes, and comments are not yet fully structured.

Do not commit personal or sensitive information.
