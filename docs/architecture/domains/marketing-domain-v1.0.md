---
artifact_id: DOMAIN-MKT-001
title: Marketing Domain
version: 1.0
status: Repository Registered
owner: CMO
architecture_steward: Chief AI Architect
---

# Marketing Domain v1.0

## Mission
Marketing Domainは、市場への認知から利益創出までのマーケティング活動をEvidenceに基づいて管理し、経営判断へ接続する。

## Scope
### In Scope
- Marketing Evidence
- Campaign
- Channel
- Attribution
- KPI
- ROI
- Funnel
- Validation

### Out of Scope
- 商品仕様
- 財務会計
- 顧客マスタ
- 実装技術

## Responsibilities
1. Evidence収集
2. Evidence Quality管理
3. ROI評価
4. Campaign評価
5. Executive Report作成

## Domain Objects
- Marketing Evidence
- Campaign
- Channel
- KPI
- Funnel
- Attribution Record

## Evidence Contract
Observation / Insight / Recommendation の3層を採用し、
Freshness・Confidence・Coverage・Traceabilityを必須項目とする。

## Validation Contract
Validation Result:
- PASS
- PASS WITH COMMENT
- CONDITIONAL PASS
- FAIL

Economic EvidenceをScale判断の主要条件とする。

## Decision Contract
Decision:
- Continue
- Stop
- Scale
- Experiment
- Resource Reallocation

DecisionにはEvidence参照を必須とする。

## Memory Contract
再利用可能なMarketing InsightをKnowledgeとして昇格管理する。

## Event Contract
代表Event:
- Campaign Created
- Campaign Started
- Campaign Completed
- Evidence Validated
- ROI Updated

## KPI
- Revenue
- Gross Profit
- ROI
- Conversion Rate
- CAC
- LTV
- Evidence Score
- Measurement Confidence

## Cross Domain Dependencies
Provider:
- Product
- Customer
- Sales
- Finance

Consumer:
- Executive

## Governance
Decision Governance v2.0へ準拠する。

## Traceability
Business Requirement
→ Evidence
→ Validation
→ Decision
→ KPI
→ Executive Report

## Version History

|Version|Status|
|---|---|
|1.0|Repository Registered|
