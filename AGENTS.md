# Session initialization

At the start of every session, before substantive work, follow
[Owner context bootstrap](docs/bootstrap/owner-context-bootstrap.md).
Run `node scripts/load-owner-memory.mjs` from the repository root and read its
complete output into the current session context. Do not redirect it to files,
public logs, reports, commits, or shared artifacts. Never reuse a previous
session's result. If execution or private access is unavailable, explicitly
report `OWNER_MEMORY_UNAVAILABLE` and follow the fallback in that procedure.
Then continue the existing v3.0 bootstrap; Owner context grants no authority.

Preserve existing code. Treat GitHub as the project Source of Truth, prefer
minimal reviewable commits, and do not change architecture or governance unless
requested. Ask before uncertain structural changes.
