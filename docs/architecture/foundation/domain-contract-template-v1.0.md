---
artifact_id: ARCH-CONTRACT-001
title: Domain Contract Template
version: 1.0
status: Draft for CEO Review
owner: Chief AI Architect
reviewer: CEO
artifact_type: Architecture Standard
architecture_layer: Foundation
baseline_candidate: Architecture Baseline v1.0
decision_report: DR-2026-ARCH-002
repository_path: docs/architecture/foundation/domain-contract-template-v1.0.md
created_at: 2026-07-27
updated_at: 2026-07-27
---

# Domain Contract Template v1.0

## 1. Purpose

本書は、AI Company OSにおけるすべてのBusiness Domainが準拠する標準Domain Contractを定義する。

Domainごとの設計品質、責任境界、入力・出力、Evidence、Validation、Decision、Memory、Event、KPIおよびCross-Domain Dependencyの表現方法を統一し、以下を実現することを目的とする。

- Business責務の明確化
- Domain間の疎結合
- 意思決定根拠の監査可能性
- Architecture Artifact間の一貫性
- 将来のDomain追加および変更容易性
- Repository上での追跡可能性
- Implementationから独立したBusiness Architectureの維持

本TemplateはArchitecture Standardである。各Domain Contractは本Templateを継承し、必要なDomain固有定義を追加しなければならない。

## 2. Scope

### 2.1 Applicable Domains

本Templateは、少なくとも以下のBusiness Domainへ適用する。

- Marketing
- Product
- Customer
- Sales
- Finance
- Knowledge
- Executive Support
- 将来追加されるBusiness Domain

### 2.2 Included

本Templateは以下を規定する。

- Domainの使命および境界
- Domain OwnerとDecision Authority
- InputsおよびOutputs
- Domain Object
- Evidence Contract
- Validation Contract
- Decision Contract
- Memory Contract
- Event Contract
- Dashboard/KPI Contract
- Cross-Domain Dependency
- GovernanceおよびVersioning
- Validation Criteria
- Traceability Requirements

### 2.3 Excluded

以下は対象外とする。

- UI設計
- API実装仕様
- Database Schema
- Programming Language
- Framework選定
- Infrastructure設計
- Operational Runbook
- 個別施策の実行手順

これらはImplementation LayerまたはOperational Layerで管理する。

## 3. Normative Language

本書では以下の意味で用語を使用する。

- **MUST**: 必須。満たさない場合は非準拠。
- **MUST NOT**: 禁止。
- **SHOULD**: 原則として必要。例外には明示的な根拠が必要。
- **MAY**: 任意。
- **Required**: MUSTと同義。
- **Optional**: MAYと同義。

## 4. Architecture Principles

各Domain Contractは以下の原則へ準拠しなければならない。

### 4.1 Business First

Domainは技術構造ではなくBusiness Responsibilityを表現する。

### 4.2 Single Responsibility

原則として、1 Domainは1つの主要Business Responsibilityを持つ。

### 4.3 Explicit Boundary

Domainが所有する責務と所有しない責務を明示する。

### 4.4 Contract First

Domain間連携は明示的なContractを介して行う。

### 4.5 Loose Coupling

他Domainの内部構造、内部状態または実装へ直接依存してはならない。

### 4.6 High Cohesion

Domain内部のObject、Rule、DecisionおよびKPIは共通のBusiness Goalへ集中する。

### 4.7 Evidence Driven

重要なDecisionは、識別可能で検証済みのEvidenceへ関連付ける。

### 4.8 Traceability

Requirement、Evidence、Validation、Decision、Memory、ADRおよびRepository Artifact間の関係を追跡可能にする。

### 4.9 Implementation Independence

Contractは特定のDatabase、AI Model、SaaS、Programming LanguageまたはFrameworkへ依存しない。

### 4.10 Repository Managed

承認後の正式版はRepositoryをSingle Source of Truthとする。

## 5. Required Document Structure

各Domain Contractは次の構造をMUSTとして持つ。

1. Metadata
2. Purpose
3. Scope
4. Mission
5. Responsibilities
6. Out of Scope
7. Domain Owner and Authorities
8. Inputs
9. Outputs
10. Core Concepts
11. Domain Objects
12. Business Rules
13. Evidence Contract
14. Validation Contract
15. Decision Contract
16. Memory Contract
17. Event Contract
18. Dashboard and KPI Contract
19. Cross-Domain Dependencies
20. Failure and Exception Policy
21. Governance
22. Traceability
23. Validation Criteria
24. Open Issues
25. Version History

未使用のSectionも削除せず、`Not Applicable`と理由を記載する。

## 6. Metadata Contract

各Domain Contractは、最低限以下のMetadataを保持する。

| Field | Required | Description |
|---|---:|---|
| artifact_id | Yes | Repository内で一意なArtifact ID |
| title | Yes | 正式名称 |
| version | Yes | Semantic Version |
| status | Yes | Draft / Review / Approved / Registered / Frozen / Deprecated |
| owner | Yes | Business責任者 |
| architecture_steward | Yes | Architecture整合性責任者 |
| reviewer | Yes | Review責任者 |
| artifact_type | Yes | Domain Contract |
| domain | Yes | 対象Domain |
| baseline_candidate | Yes | 所属予定Baseline |
| decision_report | Yes | 作成根拠となるDecision Report |
| related_adr | Conditional | Major Architecture Decisionがある場合 |
| repository_path | Yes | 正式配置先 |
| created_at | Yes | 作成日 |
| updated_at | Yes | 最終更新日 |

### 6.1 Identifier Policy

推奨形式:

`DOMAIN-{DOMAIN_CODE}-{SEQUENCE}`

例:

- `DOMAIN-MKT-001`
- `DOMAIN-PROD-001`
- `DOMAIN-CUST-001`

## 7. Purpose and Mission Contract

### 7.1 Purpose

Domainが存在する理由を記述する。

### 7.2 Mission

Domainが継続的に達成するBusiness Outcomeを1〜3文で定義する。

Missionは以下を満たす。

- 実装手段を含まない
- 他DomainのMissionと重複しない
- KPIまたはDecisionへ接続可能
- Business価値を明示する

## 8. Scope and Boundary Contract

各Domainは以下を明示する。

### 8.1 In Scope

Domainが所有する責務。

### 8.2 Out of Scope

Domainが所有しない責務。

### 8.3 Boundary Rule

他Domainとの境界に曖昧さがある場合は、Object Ownership、Decision Ownership、Source of TruthおよびEvent Producerを用いて解決する。

## 9. Responsibility Contract

各責務は以下を持つ。

| Field | Description |
|---|---|
| Responsibility ID | 一意な識別子 |
| Name | 責務名 |
| Description | Business上の説明 |
| Owner | 責任者 |
| Input | 必要情報 |
| Output | 生成情報 |
| Decision Authority | 判断権限 |
| Source of Truth | 正式情報源 |
| Related KPI | 成果指標 |

他Domainの責務を内包してはならない。

## 10. Input Contract

各Inputは以下を定義する。

- Input ID
- Name
- Producer
- Business Meaning
- Required / Optional
- Expected Freshness
- Minimum Confidence
- Validation Requirement
- Failure Handling

Inputが不足または無効な場合の挙動を明示する。

## 11. Output Contract

各Outputは以下を定義する。

- Output ID
- Name
- Consumer
- Business Meaning
- Preconditions
- Evidence References
- Validation Status
- Version
- Publication Event

OutputはConsumerが内部実装を知らずに利用できる粒度で定義する。

## 12. Core Concept Contract

各Domainは主要用語を定義し、同一語がDomain間で異なる意味を持つ場合は明示する。

各Conceptは以下を持つ。

- Canonical Name
- Definition
- Included Meaning
- Excluded Meaning
- Related Objects
- Cross-Domain Mapping

## 13. Domain Object Contract

各Domain Objectは以下を持つ。

| Field | Required |
|---|---:|
| Object ID | Yes |
| Name | Yes |
| Description | Yes |
| Business Identity | Yes |
| Lifecycle | Yes |
| Owner | Yes |
| Source of Truth | Yes |
| Required Attributes | Yes |
| Optional Attributes | Optional |
| Validation Rules | Yes |
| Related Events | Yes |
| Related Decisions | Conditional |
| Retention Policy | Conditional |

### 13.1 Object Lifecycle

最低限、以下を定義する。

- Creation condition
- Active state
- Update condition
- Invalid state
- Archive condition
- Deletion or retention rule

## 14. Business Rule Contract

各Business Ruleは以下を持つ。

- Rule ID
- Rule Statement
- Rationale
- Scope
- Input
- Output
- Exception
- Validation Method
- Related ADRまたはDecision Report

Ruleは曖昧な推奨ではなく、検証可能な記述とする。

## 15. Evidence Contract

EvidenceはObservation、InsightまたはDecision Recommendationの根拠となる情報である。

### 15.1 Required Fields

- Evidence ID
- Evidence Level
- Evidence Type
- Source
- Source Owner
- Collected At
- Valid Period
- Freshness
- Confidence
- Coverage
- Traceability
- Collector
- Validation Status
- Version

### 15.2 Evidence Levels

#### Level 1: Observation

取得された事実。解釈を含めない。

#### Level 2: Insight

Observationを分析し、意味づけしたもの。

#### Level 3: Recommendation

Validated Insightを基にした推奨判断。最終Decisionではない。

### 15.3 Evidence Quality

最低限以下を評価する。

- Source Reliability
- Freshness
- Confidence
- Coverage
- Consistency
- Traceability

### 15.4 Evidence Prohibitions

- 出典不明Evidenceの利用
- 検証前Evidenceを確定事実として扱うこと
- ObservationとInsightの混同
- Confidenceを伴わない推定
- 古いEvidenceをFreshとして扱うこと

## 16. Validation Contract

ValidationはEvidence、Object、OutputおよびDecision Preconditionsの品質を保証する。

### 16.1 Required Fields

- Validation ID
- Target ID
- Rule ID
- Validator
- Validation Method
- Executed At
- Result
- Findings
- Severity
- Remediation
- Revalidation Requirement

### 16.2 Result Values

- PASS
- PASS WITH COMMENT
- CONDITIONAL PASS
- FAIL

### 16.3 Gate Rule

`FAIL`の対象は、明示的な例外承認なしにDecisionまたはDownstream Publicationへ進めてはならない。

`CONDITIONAL PASS`は条件、期限およびOwnerを必須とする。

## 17. Decision Contract

DecisionはBusiness判断を監査可能な形で記録する。

### 17.1 Required Fields

- Decision ID
- Decision Type
- Decision Statement
- Decision Owner
- Decision Date
- Effective Date
- Related Evidence
- Validation Results
- Alternatives Considered
- Expected Outcome
- KPI Impact
- Constraints
- Review Date
- Reversal Criteria
- Status

### 17.2 Decision Status

- Proposed
- Approved
- Active
- Superseded
- Reversed
- Expired

### 17.3 Governance Escalation

以下はCEO Approvalまたは定義済みGovernance Triggerへ従う。

- Domain Boundary変更
- Company-wide Principle変更
- Cross-Domain Breaking Change
- Baseline Major Version変更
- Executive Authority変更
- High-impact Resource Reallocation

## 18. Memory Contract

Memoryは再利用可能なBusiness Knowledgeを管理する。

### 18.1 Required Fields

- Memory ID
- Title
- Summary
- Context
- Source Evidence
- Related Decisions
- Confidence
- Validity Period
- Promotion Status
- Owner
- Supersedes / Superseded By

### 18.2 Promotion Status

- Candidate
- Validated
- Promoted
- Deprecated
- Rejected

MemoryはEvidenceまたはDecisionと区別し、将来の判断へ再利用可能な知識として管理する。

## 19. Event Contract

Domain EventはBusiness上意味のある状態変化を表す。

### 19.1 Required Fields

- Event ID
- Event Name
- Business Meaning
- Trigger
- Producer
- Consumers
- Payload Definition
- Occurred At
- Effective At
- Version
- Idempotency Requirement
- Related Object
- Related Decision
- Failure Handling

### 19.2 Event Rules

- Event名は過去形または完了状態を推奨する。
- CommandとEventを混同しない。
- Internal Implementation EventはCross-Domain Event Catalogへ登録しない。
- Breaking ChangeはMajor Versionを要求する。

## 20. Dashboard and KPI Contract

Dashboardは表示画面ではなく、Domainの経営監視Contractとして定義する。

### 20.1 KPI Fields

- KPI ID
- Name
- Business Question
- Formula
- Unit
- Source Evidence
- Measurement Frequency
- Freshness Requirement
- Owner
- Target
- Threshold
- Interpretation Rule
- Known Limitations

### 20.2 KPI Categories

必要に応じて以下を使用する。

- Outcome KPI
- Leading KPI
- Quality KPI
- Efficiency KPI
- Risk KPI
- Learning KPI

Vanity Metricのみで経営判断を行ってはならない。

## 21. Cross-Domain Dependency Contract

各Dependencyは以下を明記する。

- Dependency ID
- Provider Domain
- Consumer Domain
- Contract ID
- Required / Optional
- Business Purpose
- Input / Output
- Availability Expectation
- Freshness
- Compatibility Policy
- Failure Handling
- Owner

### 21.1 Prohibited Dependencies

- 循環依存
- 内部Objectへの直接参照
- Source of Truthの重複
- 無名の非公式連携
- Version不明のContract利用

## 22. Failure and Exception Policy

各Domainは以下を定義する。

- Invalid Input
- Missing Evidence
- Stale Evidence
- Validation Failure
- Contract Version Mismatch
- Downstream Unavailability
- Ownership Conflict
- Decision Timeout
- Manual Override

Manual Overrideは、実行者、理由、期限、影響および事後Reviewを必須とする。

## 23. Governance

変更はArchitecture Change Management Frameworkに従う。

### 23.1 ADR Required

以下はADRを必須とする。

- Domain Boundary変更
- Mission変更
- Object Ownership変更
- Source of Truth変更
- Required Dependency変更
- Cross-Domain Breaking Change
- Business Meaning変更
- Baseline Major変更

### 23.2 Decision Report Required

Architecture設計および非CEO Governance判断はDecision Governance v2.0に基づくDecision Reportで記録する。

### 23.3 CEO Approval Trigger

CEO承認は、Governance Frameworkで定義された明示的Triggerがある場合に限る。

## 24. Traceability

最低限、以下の経路を追跡可能にする。

`Business Requirement → Decision Report / ADR → Domain Responsibility → Contract → Evidence → Validation → Decision → KPI → Memory`

各Artifactは関連Artifact IDを保持する。

## 25. Validation Criteria

| Check | Requirement |
|---|---|
| Metadata completeness | Required |
| Mission clarity | Required |
| Scope / Out of Scope | Required |
| Ownership clarity | Required |
| Inputs / Outputs | Required |
| Domain Objects | Required |
| Business Rules | Required |
| Evidence Contract | Required |
| Validation Contract | Required |
| Decision Contract | Required |
| Memory Contract | Required |
| Event Contract | Required |
| KPI Contract | Required |
| Dependency Definition | Required |
| Failure Policy | Required |
| Governance Compliance | Required |
| Traceability | Required |
| No circular dependency | Required |
| Implementation independence | Required |

## 26. Review Outcome

使用可能なReview Resultは以下とする。

- PASS
- PASS WITH COMMENT
- CONDITIONAL PASS
- FAIL

`PASS`または明示条件を満たした`CONDITIONAL PASS`のみRepository Registration候補となる。

## 27. Open Issues

CEO Review前のOpen Issueは、各Domain Contract内で明示する。

本Template v1.0時点では、以下を将来検討対象とする。

- Knowledge Domainの正式追加時期
- Executive Support Domainの独立性
- Domain KPIとCompany KPIの統合規則
- Automated Validationの適用範囲

## 28. Related Documents

- Architecture Principles v1.0
- Architecture Baseline v1.0
- Cross-Domain Contract Library v1.0
- Architecture Change Management Framework v1.0
- ADR Catalog v1.0
- Repository Governance Manual v1.0
- Architecture Review Checklist v1.0

## 29. Version History

| Version | Date | Status | Changes |
|---|---|---|---|
| 1.0 | 2026-07-27 | Draft for CEO Review | Initial complete draft |
