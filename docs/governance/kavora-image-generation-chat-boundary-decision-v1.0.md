---
artifact_id: GOV-IMG-BOUNDARY-001
title: KAVORA Image Generation Chat Boundary Decision
version: 1.0
status: Owner Approved
lifecycle: Repository Registration Pending
artifact_type: Governance Decision
owner: Owner
steward: CEO
approval_authority: Owner
organization: KAVORA
operating_platform: AI Company OS
approved_at: 2026-08-23
---

# KAVORA Image Generation Chat Boundary Decision v1.0

## 1. Owner Decision

KAVORAでは、画像生成・生成AIによる画像編集・再生成・Variation・Style Transfer等は、専用の **Image Generation Chat** 以外で実行しない。

本DecisionはOwnerの明示Decisionに基づき、KAVORAの運用方針として即時適用する。

## 2. Scope

以下のValid Executive Role Chatでは画像生成を禁止する。

- CEO
- CPO
- CMO
- Chief AI Architect
- Chief Software Engineer

DX / DX2その他のKAVORA作業Chatも、Image Generation Chatとして明示指定されていない限り画像生成を実行しない。

## 3. Required Handoff

画像が必要な場合、役員・作業Chatは画像生成を実行せず、以下を行う。

1. 画像の目的・内容・仕様・禁止事項を確定する。
2. 完成状態のGeneration Brief / Promptを作成する。
3. Image Generation ChatへExecutionを移す。
4. 必要に応じて生成結果を元Roleへ戻し、Business / Product / Revenue / Architecture上の評価だけを行う。

Image Generation Chatは画像Execution専用であり、Executive Authorityを持たない。

## 4. Allowed Outside Image Generation Chat

- 画像の分析
- 画像要件・仕様策定
- Generation Brief / Prompt作成
- 生成結果の評価

## 5. Prohibited Outside Image Generation Chat

- 新規画像生成
- 生成AIによる画像編集・再生成
- Variation生成
- Style Transfer
- 生成AIベースのUpscale / Retouch等

Ownerの明示Approvalがある場合のみ例外を認める。

Role変更、DX / DX2、Automation、別Chat等を利用して本Boundaryを迂回してはならない。

## 6. Rationale

目的は以下。

- Executive ChatのContext Scopeを保護する。
- Revenue / Product / Architecture / Governance DecisionとImage Executionを分離する。
- Context混線、Direction Drift、運用負荷の可能性を低減する。
- 画像Executionを専用Chatへ集約する。

画像生成がChat DriftやChat性能低下を直接引き起こす技術的因果関係は **Unverified** とする。

本Decisionは、その因果関係のConfirmedを前提とせず、Ownerの運用上のRisk判断およびContext Separation方針として適用する。

## 7. Runtime Requirement

GitHub保存だけでは各Chat Runtimeへ自動適用されたとは扱わない。

KAVORA Project Instructionsまたは対応Runtimeへ、本Decisionの意味を維持したMinimum Clauseを実際に導入し、対象Roleで確認できた場合のみ Runtime Installation / Synchronization をConfirmedとする。

### Minimum Runtime Clause

KAVORA Image Generation Boundary: Image Generation Chat以外で画像生成・生成AI画像編集を実行してはならない。CEO / CPO / CMO / Chief AI Architect / Chief Software EngineerおよびDX / DX2等の非指定作業Chatは、画像が必要な場合はGeneration Brief / Promptのみ作成し、Image Generation ChatへExecutionを移す。Image Generation Chatは画像Execution専用でExecutive Authorityを持たない。Owner明示Approval以外の例外は禁止する。

## 8. Status

- Owner Approval: Confirmed — direct Owner instruction on 2026-08-23 JST
- Temporary Artifact Creation: Confirmed
- GitHub Canonical Commit: Not Executed
- Repository Registration: Pending
- Runtime Installation: Pending
- Runtime / Repository Synchronization: Pending
