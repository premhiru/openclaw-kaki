[kaki/README.md, # Kaki workspace

This directory contains Kaki's household product packages, regional skills, fixtures, evaluation harness, operator documentation, and acceptance tooling. The runtime plugin lives at `extensions/kaki`; the repository-root `kaki.mjs` launcher runs it on OpenClaw.

For user setup, start with the [Kaki quickstart](../docs/kaki/quickstart.md). This page is for contributors and release operators.

## Requirements

- Ubuntu/Linux or macOS for the checked-in source installer
- Node.js `22.22.3–22.x`, `24.15.0–24.x`, or `25.9.0–25.x`
- Corepack; the repository pins pnpm `12.1.0`
- Git
- Docker with Compose only for the optional development service scaffold

Native Windows is not part of the installer acceptance path.

## Install and onboard

```bash
./kaki/scripts/install.sh --dry-run
./kaki/scripts/install.sh
kaki onboard --classic --install-daemon \
  --kaki-profile /protected/path/profile.json
kaki gateway status
kaki status --deep
```

Use [the safe profile template](examples/onboarding-profile.example.json) and [onboarding guide](docs/ONBOARDING.md). The installer always resolves and builds the repository root, even when invoked from another directory.

## Development checks

From the repository root:

```bash
pnpm --dir kaki format:check
pnpm --dir kaki lint
pnpm --dir kaki typecheck
pnpm --filter @openclaw/kaki typecheck
pnpm --dir kaki test
pnpm --filter @openclaw/kaki test
pnpm --dir kaki coverage
pnpm --dir kaki test:qa
pnpm --dir kaki test:e2e
pnpm --dir kaki evals
pnpm --dir kaki security:scan
pnpm --dir kaki docs:check
pnpm audit --audit-level high
```

Fixture replay checks recorded contracts unless a runtime adapter is explicitly supplied. Read [Evaluation architecture](evals/README.md) before interpreting a green result.

`pnpm --dir kaki acceptance` reports deterministic evidence and names pending live checks. `pnpm --dir kaki acceptance:release` is stricter and must not pass without non-fixture evidence for the exact build.

## Repository guide

- [Architecture](docs/ARCHITECTURE.md)
- [Interfaces](docs/INTERFACES.md)
- [Decisions](docs/DECISIONS.md)
- [Personas](docs/PERSONAS.md)
- [Onboarding](docs/ONBOARDING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Runbook](docs/RUNBOOK.md)
- [Verification](docs/VERIFY.md)
- [Skill catalogue](docs/SKILLS.md)
- [Locale guide](docs/LOCALE.md)
- [Requirements ledger](docs/REQUIREMENTS.md)
- [Contributing](CONTRIBUTING.md)

Public operator documentation is under [`docs/kaki`](../docs/kaki/index.md).

## Safety and evidence

Kaki's policy engine, facts-bound approval ledger, SecretRef validation, and private-profile encryption are implemented and tested. That does not make every external integration or UI workflow complete. In particular, physical Android control, universal pause enforcement, hard model budgets, quiet hours, and several Control UI mutations remain limited.

Never put plaintext secrets in plugin config, profiles, fixtures, screenshots, or issues. Do not use personal primary accounts or meaningful payment amounts during development. See [Known limitations](../docs/kaki/limitations.md) before a live probe.

## License and upstream

Kaki is MIT licensed. Fork provenance and the pinned upstream are recorded in [UPSTREAM.md](UPSTREAM.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).].Value