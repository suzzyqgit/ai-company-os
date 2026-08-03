---
artifact_id: DEC-ORG-NAME-001
title: KAVORA Organization Naming Decision
version: 1.0
status: Approved
artifact_type: Organization Decision
decision_authority: Owner
decision_date: 2026-08-03
effective_date: 2026-08-03
---

# KAVORA Organization Naming Decision v1.0

## Decision

組織・会社・経営主体の正式名称を`KAVORA`とする。

`AI Company OS`は廃止せず、KAVORAを運営する内部経営基盤の名称として維持する。

## Naming Boundary

### KAVORA

次の主体を指す。

- 組織全体
- 全社Priority
- Portfolio
- Case
- Business Unit
- Cash Engine / Growth Engine / Revenue Engine
- 組織の利益およびOwner負担削減

### AI Company OS

次の内部基盤を指す。

- Role Runtime
- Governance
- Contract / Standard
- Repository Architecture
- Operational Data Layer
- Decision / Execution / Evidence / Learning接続
- Automation / Agent Runtime

## Non-Changes

本Decisionは次を変更しない。

- Ownerの最終権限
- CEO、CPO、CMO、Chief AI Architect、Chief Software Engineer、CBUのAuthorityと責任境界
- Active Caseの状態
- Repository名`ai-company-os`
- Local repository path
- Branch名
- Commit SHA
- Artifact ID、Case ID、Decision ID
- API、Database、Environment Variable等の技術識別子
- 過去の履歴文書およびEvidence

## Synchronization Requirement

Project InstructionsのOrganization ContextおよびEmbedded Role Profilesと、GitHub Canonical Role Profilesを同一Change Setで更新する。

完了条件は次のEvidenceを必要とする。

1. Exact Project InstructionsのRuntime保存確認
2. GitHub Commit SHA
3. Push結果
4. Remote上の対象Path確認
5. Sync Manifest hash一致
6. KAVORA Identity Regression
7. Runtime–Repository parity確認

Evidenceが揃うまで`Synchronized`または`Completed`とは報告しない。
