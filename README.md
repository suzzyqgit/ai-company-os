# AI Company OS

AI Company OS is an operational system for building and operating an AI-driven
company. The repository combines governance, architecture, organizational
knowledge, and a TypeScript application used for bounded operational workflows.

This repository is the official Source of Truth for the project.

## Purpose

AI Company OS enables KAVORA Operating AI to coordinate work through shared
governance, architecture, operational data, and continuous organizational
learning. It keeps operating rules and implementation evidence close to the
software they govern.

## Status and Scope

AI Company OS is in active development. The repository currently contains:

- governance, runtime, role, architecture, knowledge, and validation documents;
- a Next.js operational application for content, revenue, imports, analytics,
  product data, and daily work views;
- Prisma-backed data models and bounded import and promotion workflows;
- automated tests for core operational and governance-related behavior.

This status does not imply production adoption, compatibility guarantees, or a
stable public API.

## Repository Principles

- Repository First
- Source of Truth
- Governance-Driven Development
- Documentation as Operational Foundation

## Repository Structure

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes and application views |
| `components/` | Shared user-interface components |
| `features/` | Domain-focused application behavior and queries |
| `lib/` | Shared implementation infrastructure |
| `prisma/` | Prisma schema, migrations, and development data tooling |
| `tests/` | Automated application and workflow tests |
| `docs/governance/` | Governance records and current permanent operating memory |
| `docs/bootstrap/` | Runtime bootstrap and manifest artifacts |
| `docs/architecture/` | Architecture foundations, domains, contracts, and validation |
| `docs/roles/` | Preserved executive role profiles and role registry history |
| `docs/knowledge/` | Preserved organizational knowledge and evidence |
| `docs/repository/` | Repository conventions and registration records |
| `docs/standards/` | Task-specific and operational standards |

## Explore the Repository

Start with the areas most relevant to your purpose:

- [Current Runtime Manifest](docs/bootstrap/kavora-runtime-manifest-v3.0.md)
- [Project Runtime Kernel v3.0 Mirror](docs/bootstrap/kavora-project-runtime-kernel-v3.0.md)
- [Current Permanent Operating Memory](docs/governance/kavora-permanent-operating-memory-v3.0.md)
- [Governance Repository Index](docs/governance/REPOSITORY_INDEX.md)
- [Architecture Baseline](docs/architecture/foundation/architecture-baseline-v1.0.md)
- [Architecture Principles](docs/architecture/foundation/architecture-principles-v1.0.md)
- [Legacy Role Profiles](docs/roles/)
- [Repository Directory Standard](docs/repository/repository-directory-standard-v1.0.md)

The v3.0 Kernel, Runtime Manifest, and Permanent Operating Memory are the active
repository-canonical runtime set. Kernel v3.0 is installed in the ChatGPT
Project Instructions, and activation is confirmed. Runtime v2.1 is superseded
and historical. Former executive role artifacts remain preserved as
`LEGACY / HISTORICAL ONLY` for traceability.

Owner personal context is loaded from a private canonical source through the
[session bootstrap](docs/bootstrap/owner-context-bootstrap.md). Private personal
context must not be added here.

## Local Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The repository includes an [environment example](.env.example). Keep local
environment values and credentials out of version control.

Available validation commands are defined in `package.json`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution workflow, validation
expectations, repository conventions, and governance boundaries.

## License

The entire repository, including software, application code, governance and
architecture documents, Permanent Operating Memory, role profiles, standards,
operational documentation, templates, and other repository content, is licensed
under the [Apache License 2.0](LICENSE) unless a specific file explicitly states
otherwise.
