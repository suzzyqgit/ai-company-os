# Owner personal context bootstrap

Owner personal context is loaded from a private canonical source at the start of
every AI/KAVORA/Codex session, before substantive work. This is a context-loading
step, not a new governance layer or a required artifact that blocks v3.0.

- Source: `suzzyqgit/owner-memory-private`, `OWNER_MEMORY.md`, current default branch.
- Shell agents: run `node scripts/load-owner-memory.mjs` from the repository root
  and consume the complete output in the private session context.
- Connector-only agents: fetch the complete file from that same private GitHub
  source using the authenticated connector on every session start. On verified
  success record `OWNER_MEMORY_LOADED` and the returned blob SHA in the session;
  missing access, incomplete content, or any fetch failure is unavailable.
- Use existing GitHub CLI authentication or its supported `GH_TOKEN` /
  `GITHUB_TOKEN` environment variables. Never store credentials in the repository.

Use the content as the highest-priority source of Owner personal strategic
context, constraints, and behavioral context, subject to current explicit Owner
instructions. It is not Governance, a Canonical Decision Source, authorization,
or an override of KAVORA internal rules. Preserve dates and evidence qualifiers;
do not turn old financial or other time-sensitive statements into current facts.

On failure, report `OWNER_MEMORY_UNAVAILABLE`, discard partial results, and
continue the existing v3.0 Kernel / Manifest / POM bootstrap. Owner-specific
unknowns remain UNKNOWN: do not infer them from historical chats, cached memory,
or guesses. Ask only if a missing fact is necessary for the current task.

Fetch afresh every session; do not cache, sync, or copy the private file into the
public repository. Private edits take effect on the next fetch without public
code changes. Output belongs only in the authorized private AI session, never in
public CI logs, reports, or artifacts. Tests use synthetic content only.

Validation: `node --test tests/owner-memory-bootstrap.test.ts` (also included by
`npm test`). Loaded status proves retrieval, not universal provider enforcement:
AGENTS-aware Codex sessions and agents following the current Manifest execute
this step; a disconnected provider must report unavailable, not claim a load.
