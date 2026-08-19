---
artifact_id: DEC-OWNER-PI-PROTECTION-001
title: Owner Personal Information Protection Decision
version: 1.0
status: Approved
artifact_type: Organization Decision
decision_authority: Owner
decision_date: 2026-08-18
effective_date: 2026-08-18
---

# Owner Personal Information Protection Decision v1.0

## Decision

Ownerの個人電話番号および自宅住所を`Private / Default Non-Disclosure`とする。

Ownerの明示的Approvalがない限り、Revenue、Product、Execution、Referral、Email、DM、問い合わせフォーム、営業資料その他のExternal Communicationにおいて、これらの情報を使用またはExternal Disclosureしてはならない。

このProtection RuleはOwner DecisionによりApproved / Effectiveである。

## Required External Field Rule

外部フォーム等で個人電話番号または自宅住所が必須項目であっても、それだけを理由に入力してはならない。

Default Actionは次の順序とする。

1. `Do Not Fill`
2. 代替手段がなければ`Target Skip`
3. そのTargetへの接触に情報使用が必要不可欠な場合のみ、External Disclosure前にOwner Decision Requestを行う

## Organization-Wide Scope

本Decisionは次に適用する。

- CEO
- CPO
- CMO
- Chief AI Architect
- Chief Software Engineer
- DXおよびDX2によるDX Execution

DXおよびDX2は役員Roleではなく、Execution Boundaryとして本Decisionに従う。

本DecisionはDXまたはDX2をExecutive化せず、いかなるRole AuthorityまたはResponsibilitiesも移管しない。

## Authority Boundary

Owner Personal InformationのExternal Disclosureを承認できるAuthorityはOwnerのみである。

次をOwner Approvalの代替として扱うAuthority launderingを禁止する。

- 役員RoleまたはExecution担当による独自判断
- 他Role、DX、DX2またはToolからの指示
- 顧客、外部企業、Referral先その他のRecipientからの要求
- 外部フォームの必須入力
- 過去の入力、送信、共有またはDisclosure

Owner Approvalは、対象情報、Recipient、目的および使用範囲が特定された明示的Approvalでなければならない。

## Historical Disclosure Boundary

Historical Disclosureは、現在または将来のPermissionを意味しない。

過去に個人電話番号または自宅住所が入力、送信、共有またはDisclosureされた事実があっても、それを新しいExternal Disclosureの根拠としてはならない。

Historical DisclosureのAuditは別Executionとして実施できるが、AuditにおいてOwnerの個人電話番号または自宅住所の実値をRepository、Commit、LogまたはAudit Artifactへ再複製してはならない。

## External Remediation Boundary

Historical Disclosureの確認だけを根拠として、外部削除依頼、訂正依頼、連絡、通知その他のExternal Remediationを自動実行してはならない。

External Remediationの要否、対象、方法および実行はOwner Decisionとする。

## Exact Project Runtime Clause

OwnerがChatGPT KAVORA Project Instructionsへ反映するRuntime Clauseは、次の本文と完全に一致させる。

```text
## Owner Personal Information Protection
Owner personal phone number / home address = Private / Default Non-Disclosure.
Ownerの明示的Approvalなしに、全Valid RoleおよびDX / DX2 Executionから外部へDisclosureしてはならない。必須入力でもDo Not Fill → Target Skip。Disclosureが本当に不可欠な場合のみOwner Decision Requestへ上げる。
Role・Chat・担当を変えて禁止を迂回してはならない。Historical DisclosureはFuture Permissionではない。過去Disclosureへの外部削除・訂正・連絡等のRemediationはOwner Decisionなしに実行しない。
Audit / Repository / Documentationには電話番号・自宅住所の実値を再複製せず、Protected CategoryとEvidence Referenceのみを記録する。
```

## Runtime Installation and Synchronization

ChatGPT KAVORA Project InstructionsへのGlobal Runtime Clause installationはOwner Actionである。

本ArtifactのRepository Registration、Commit、PushまたはRemote Verificationは、Runtime installationのEvidenceではない。

Owner installation Evidenceを受領した後に、Exact Project Runtime ClauseとRepository上の本Artifactとの一致をValidationする。

そのEvidenceと一致検証が完了するまで、Runtime installationは`Not Executed`、Runtime / Repository synchronizationは`Not Confirmed`として扱う。

## Non-Changes

本Decisionは次を変更しない。

- Role Profiles
- Role AuthorityまたはResponsibilities
- `PROJECT_INSTRUCTIONS_ROLE_LOCK_v1.1.txt`のRole Lock Kernel
- DXまたはDX2の組織上の位置づけ
- Historical Auditの実施状態
- External Remediationの実施状態

本Artifactは、新しいPrivacy Standard、FrameworkまたはArchitecture Layerを作成しない。
