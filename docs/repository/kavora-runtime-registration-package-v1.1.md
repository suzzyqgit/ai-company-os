# KAVORA Runtime Registration Package v1.1

## 1. Decision Report

| Field | Value |
|---|---|
| Decision | Register KAVORA Permanent Operating Memory v1.4 and KAVORA Runtime Manifest v1.3 as the current Owner-approved runtime artifacts. |
| Authority | Owner / Chief AI Architect execution handoff and the byte-exact attached source artifacts. |
| Repository | `suzzyqgit/ai-company-os` |
| Base commit | `f8b90ac2b939a5f35d2236858897094fa00afa83` |
| Scope | The two source artifacts, this registration package, and one required Governance CHANGELOG entry. |
| Phase boundary | Phase 1 preserves the source Manifest's pre-registration status evidence. GitHub synchronization status is updated separately only after Phase 1 remote evidence passes. |
| Exclusions | No Project Instructions, Role Profile, Architecture, legacy artifact, commercial, marketplace, product, or revenue execution change. |

## 2. Validation Record

| Validation | Result |
|---|---|
| Source SHA-256 | PASS - both supplied digests matched. |
| Source Git blob SHA | PASS - both supplied blob identifiers matched. |
| Source-content preservation | PASS - repository artifacts are byte-identical to the supplied sources. |
| Markdown and front matter | PASS - both source front matters parse as YAML and both artifacts contain an H1. |
| Target-path collision | PASS - both artifact targets and this package path were absent at the base commit. |
| Artifact ID / version collision | PASS - the existing Artifact identities continue with new, non-conflicting versions 1.4 and 1.3. |
| Dependency and supersedes chain | PASS - Manifest v1.3 points to POM v1.4; POM v1.4 supersedes v1.3; Manifest v1.3 supersedes v1.2. |
| Role Profile pointers | PASS - all five referenced Role Profile Git blob SHAs match the base commit. |
| Historical version preservation | PASS - POM v1.3 and Runtime Manifest v1.2 remain unchanged and present. |
| Governance change record | PASS - the existing `docs/governance/CHANGELOG.md` receives one bounded POM v1.4 registration entry; the Repository Index does not require modification. |
| Bounded scope | PASS - no Project Instructions, Role Profile, Architecture, Standard, commercial, marketplace, product, or revenue execution file is changed. |
| Repository diff | PASS WITH APPROVED BOUNDED EXCEPTION - `REG-VAL-EOF-002` is the sole `git diff --check` finding; all other findings and unrelated diffs are zero. |
| `REG-VAL-EOF-002` | APPROVED - the canonical Owner-approved POM v1.4 ends with two LF bytes. The final blank line is preserved because normalization would change the required SHA-256 and Git blob SHA. |

## 3. Registration Manifest

| Artifact ID | Name | Version | Status | Owner / Steward | Location | Dependency | SHA-256 | Git blob SHA |
|---|---|---|---|---|---|---|---|---|
| `KAVORA-PERMANENT-OPERATING-MEMORY-001` | KAVORA Permanent Operating Memory | 1.4 | Owner Approved | Owner | `docs/governance/kavora-permanent-operating-memory-v1.4.md` | Project Runtime Kernel / Role Lock remains controlling for role governance. | `7ca36d45440691b08cbe4ec3df2e998c70227c859ae5f0e7cc047da3d1feef3d` | `b16b4745c45c67ae848d33685426664503545dec` |
| `KAVORA-RUNTIME-MANIFEST-001` | KAVORA Runtime Manifest | 1.3 | Active | Owner / CEO steward | `docs/bootstrap/kavora-runtime-manifest-v1.3.md` | KAVORA Permanent Operating Memory v1.4 and the current runtime sources referenced by the Manifest. | `bc6a04daa2f183c931ef1ea32a2cb52c058cca54d33fbc76336b506b0ff148dd` | `1f3934b91c6618305cf963a0e77794210ee54cd3` |

## 4. Dependency Report

| Dependency check | Evidence |
|---|---|
| Manifest to POM | Runtime Manifest v1.3 names and requires `KAVORA_PERMANENT_OPERATING_MEMORY_v1.4.md`. |
| POM supersedes | POM v1.4 declares `KAVORA_PERMANENT_OPERATING_MEMORY_v1.3.md` as superseded. |
| Manifest supersedes | Runtime Manifest v1.3 declares `KAVORA_RUNTIME_MANIFEST_v1.2.md` as superseded. |
| Historical artifacts | `docs/governance/kavora-permanent-operating-memory-v1.3.md` and `docs/bootstrap/kavora-runtime-manifest-v1.2.md` remain present and unchanged. |
| Runtime authority | Project Instructions and Role Profiles remain unchanged; this registration creates no additional authority. |
| Execution boundary | Repository registration does not restart commercial, marketplace, product, outreach, or revenue execution. |
