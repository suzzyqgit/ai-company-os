# Contributing to AI Company OS

Thank you for considering a contribution. Keep proposals focused, factual, and
reviewable, and preserve the repository's existing authority boundaries.

## Contribution Routes

- Use an Issue to report a reproducible problem, propose a bounded enhancement,
  or discuss a change whose scope is not yet clear.
- Use a Pull Request for a concrete, reviewable change.

Before starting a substantial change, check existing Issues and Pull Requests to
avoid duplicated work.

## Branch and Pull Request Expectations

1. Create a focused branch from the current target branch.
2. Keep each Pull Request limited to one coherent purpose.
3. Explain what changed, why it changed, and how it was validated.
4. Identify affected governance, architecture, data, or runtime boundaries.
5. Avoid unrelated cleanup, generated-file churn, or dependency changes.
6. Do not rewrite or remove existing work that is outside the proposed scope.

## Repository Conventions

Place changes within the existing directory structure. Review the
[Repository Directory Standard](docs/repository/repository-directory-standard-v1.0.md)
and nearby files before introducing a new path or document type.

Documentation should be precise about status and evidence. Do not report work as
approved, registered, validated, synchronized, frozen, released, or completed
without the corresponding evidence.

## Validation

Run checks appropriate to the changed area. The repository currently provides:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Documentation-only changes should also pass:

```bash
git diff --check
```

Include relevant results and any known limitations in the Pull Request. Do not
change unrelated code solely to make a check pass.

## Secrets, Privacy, and Confidentiality

Never commit:

- secrets, API keys, tokens, passwords, or credentials;
- protected personal data;
- confidential or third-party restricted material;
- populated local environment files or private production data.

Use placeholders in examples and follow `.gitignore` and `.env.example` for local
configuration.

## Governance Boundaries

Contributors may propose governance-related changes, but contribution access does
not grant Owner authority, Chief AI Architect authority, approval authority, or
governance registration authority.

Approved, Frozen, governed, and current runtime artifacts must not be casually
rewritten. Changes affecting governance-controlled artifacts may require additional
review and the repository's existing approval procedures. A merged Pull Request
does not, by itself, redefine governance authority or make a governance proposal
operational.

When uncertain about an artifact's status or required process, open an Issue or
request maintainer guidance before changing it.
