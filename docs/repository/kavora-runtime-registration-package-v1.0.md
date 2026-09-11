# KAVORA Runtime Registration Package v1.0

## 1. Decision Report

| Field | Value |
|---|---|
| Decision | Register KAVORA Permanent Operating Memory v1.3 and KAVORA Runtime Manifest v1.2 as the current canonical runtime artifacts identified by the approved sources. |
| Authority | Owner-approved source artifacts and the bounded repository registration handoff. |
| Repository | `suzzyqgit/ai-company-os` |
| Base commit | `bd32782d8cc6d6f2bf82428622d31f312b3e1e62` |
| Scope | The two source artifacts, this registration package, and one required governance CHANGELOG entry. |
| Exclusions | No Project Instructions, Role Profile, Architecture, legacy bootstrap, commercial, marketplace, product, or revenue execution change. |

## 2. Validation Record

| Validation | Result |
|---|---|
| Source SHA-256 | PASS - both supplied digests matched. |
| Source Git blob SHA | PASS - both supplied blob identifiers matched. |
| Source-content preservation | PASS - repository artifacts are byte-identical to the supplied sources. |
| Markdown and front matter | PASS - both source front matters parse as YAML and all registered Markdown files contain an H1. |
| Target-path collision | PASS - all three target paths were absent at the base commit. |
| Artifact-ID collision | PASS - no existing registration of either Artifact ID was found at the base commit. |
| Dependency and supersedes chain | PASS - Manifest v1.2 points to POM v1.3; POM v1.3 supersedes v1.2; Manifest v1.2 supersedes v1.1. |
| Legacy bootstrap preservation | PASS - `docs/bootstrap/role-bootstrap-procedure-v1.1.md` remains unchanged. |
| Governance change record | PASS - the existing `docs/governance/CHANGELOG.md` receives one bounded POM v1.3 registration entry; the Repository Index does not require modification. |
| Bounded scope | PASS - no Project Instructions, Role Profile, Architecture, commercial, marketplace, product, or revenue execution file is changed. |
| Repository diff | PASS WITH APPROVED BOUNDED EXCEPTION - `REG-VAL-EOF-001` is the sole `git diff --check` finding; all other findings and unrelated diffs are zero. |
| `REG-VAL-EOF-001` | APPROVED - the canonical Owner Approved POM ends with two LF bytes. The final blank line is preserved because normalization would change the required SHA-256 and Git blob SHA. |

## 3. Registration Manifest

| Artifact ID | Name | Version | Status | Owner / Steward | Location | Dependency | SHA-256 | Git blob SHA |
|---|---|---|---|---|---|---|---|---|
| `KAVORA-PERMANENT-OPERATING-MEMORY-001` | KAVORA Permanent Operating Memory | 1.3 | Owner Approved | Owner | `docs/governance/kavora-permanent-operating-memory-v1.3.md` | Project Runtime Kernel / Role Lock remains controlling for role governance. | `8f6e62f8506d8aa441cef0d8862b1e316a00dc6dfcaada649878d524136a15ef` | `f81ee7d144bb3dc3e9bc169a739d4a8f174482cb` |
| `KAVORA-RUNTIME-MANIFEST-001` | KAVORA Runtime Manifest | 1.2 | Active | Owner / CEO steward | `docs/bootstrap/kavora-runtime-manifest-v1.2.md` | KAVORA Permanent Operating Memory v1.3 and the current runtime sources referenced by the Manifest. | `8f5ae02456affff8afcfb8f74951722744bbefc02175e41752fbf6e8cf4545fe` | `8b2383513d0b9ecc40a7f0ef8bb3e4dd416f48ab` |

## 4. Dependency Report

| Dependency check | Evidence |
|---|---|
| Manifest to POM | Runtime Manifest v1.2 names and requires `KAVORA_PERMANENT_OPERATING_MEMORY_v1.3.md`. |
| POM supersedes | POM v1.3 declares `KAVORA_PERMANENT_OPERATING_MEMORY_v1.2.md` as superseded. |
| Manifest supersedes | Runtime Manifest v1.2 declares `KAVORA_RUNTIME_MANIFEST_v1.1.md` as superseded. |
| Legacy bootstrap | `docs/bootstrap/role-bootstrap-procedure-v1.1.md` is preserved as historical / compatibility evidence. |
| Runtime authority | Project Instructions and Role Profiles remain unchanged; this registration creates no additional authority. |
| Execution boundary | Repository registration does not restart commercial, marketplace, product, or revenue execution. |
