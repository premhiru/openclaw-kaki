---
summary: "Set up a Kaki development checkout, understand package boundaries, and make safe contributions."
read_when:
  - You are changing Kaki code, UI, skills, or documentation
  - You need the repository layout and development commands
  - You are preparing a pull request
title: "Develop Kaki"
---

Kaki lives inside the OpenClaw monorepo and uses the root pnpm workspace. Make changes from a source checkout, keep Kaki-specific behavior behind the launcher/plugin boundary, and preserve upstream OpenClaw behavior outside that boundary.

## Prerequisites

- Git;
- supported Node.js: `22.22.3–22.x`, `24.15.0–24.x`, or `25.9.0–25.x`;
- Corepack;
- the repository-pinned pnpm `12.1.0`.

Plain `npm install` at the repository root is unsupported.

## Set up

```bash
git clone https://github.com/premhiru/openclaw-kaki.git
cd openclaw-kaki
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

Use a feature branch. Do not develop against private household state or real credentials.

## Repository layout

| Path | Purpose |
| --- | --- |
| `kaki.mjs` | managed launcher and workspace seeding |
| `extensions/kaki` | OpenClaw plugin, commands, HTTP routes, onboarding, owners |
| `kaki/apps/control-ui` | Kaki operator interface |
| `kaki/packages/core` | Kaki contracts, delivery, learning, and minimal CLI |
| `kaki/packages/security` | policy, audit, secrets, trust, pacing, redaction |
| `kaki/packages/memory` | household graph and persistence helpers |
| `kaki/packages/models` | model adapters, routing, normalization, cost/audio helpers |
| `kaki/packages/sg-data` | Singapore data and monitor logic |
| `kaki/packages/sea-data` | regional capabilities, QR, profiles, and clients |
| `kaki/packages/browser-node` | browser execution surface |
| `kaki/packages/phone-node` | ADB/companion phone surface and playbooks |
| `kaki/packages/approval-node` | approval cards, rendering, and lifecycle contracts |
| `kaki/packages/locale` | regional language/format assets |
| `kaki/packages/skills` | maintained regional playbooks and catalogue |
| `kaki/tests`, `kaki/evals` | product QA, fixtures, and evaluation evidence |
| `docs/kaki` | public documentation |
| `kaki/docs` | engineering specifications and internal runbooks |

## Package boundaries

Use package public entry points. Do not read another package's database or internal files. Compile-time contracts live under `kaki/packages/core/src/contracts`; runtime input must still be validated.

OpenClaw owns Gateway authentication, channels, sessions, models, and standard commands. Kaki integrations should adapt through public plugin/runtime owners rather than fork unrelated upstream code.

## Common commands

From the repository root:

```bash
pnpm build
pnpm check
pnpm test
```

Kaki-focused commands:

```bash
pnpm --dir kaki build
pnpm --dir kaki lint
pnpm --dir kaki format:check
pnpm --dir kaki typecheck
pnpm --dir kaki test
pnpm --dir kaki test:qa
pnpm --dir kaki test:e2e
pnpm --dir kaki evals
pnpm --dir kaki security:scan
pnpm --dir kaki docs:check
pnpm --dir kaki acceptance
pnpm --dir kaki verify
```

`verify` is the broad product gate. Run focused tests while iterating, then run the complete gate before requesting review.

## Test state

Use an isolated temporary `KAKI_HOME` and fixture credentials. Never point a test process at a real household home.

```bash
export KAKI_HOME="$(mktemp -d)"
```

Remove the temporary directory only after confirming the exact path and preserving any needed sanitized diagnostics.

## Plugin development

The plugin is registered by `extensions/kaki/openclaw.plugin.json`. Keep its configuration non-secret. New routes must use Gateway authentication, explicit scopes, bounded request parsing, no-store responses, deadlines, and projections that exclude secrets.

New Telegram commands must be channel-limited, authenticated, owner-gated, and assigned the narrowest operator scope.

## Control action development

The action parser uses exact-key schemas and bounded values. When adding an action:

1. add/update the contract;
2. add exact parser validation;
3. map it to one authoritative owner;
4. project the result without raw private data;
5. add method/auth/size/concurrency tests;
6. add negative tests for extra keys and stale state;
7. document the payload in [Reference](/kaki/reference).

## Skill development

Use a stable region-prefixed slug and declare inputs, surfaces, risk, approval boundary, recovery, and fixtures. A skill must not embed credentials or broaden permission.

```bash
pnpm --filter @kaki/skills generate:check
pnpm --filter @kaki/skills typecheck
pnpm --filter @kaki/skills test
```

See [Kaki skills](/kaki/skills).

## UI development

The packaged UI is built from `kaki/apps/control-ui` into plugin assets. Keep UI claims aligned with owner behavior. A button response is not proof of an external commit.

Run the package's lint, typecheck, tests, and build. Verify the generated assets and authenticated mount path through the Gateway.

## Documentation development

Public docs use root-relative links without `.md` suffixes. Every page needs `title`, `summary`, and `read_when` frontmatter. Add pages to `docs/docs.json` under the Kaki tab.

Run:

```bash
pnpm --dir kaki docs:check
pnpm check:docs
pnpm exec oxfmt --check README.md docs/docs.json docs/kaki
```

Document only what the exact code and evidence support. Link engineering specifications for depth, but keep aspirational design separate from released capability.

## Pull request checklist

- [ ] focused change and explicit scope;
- [ ] no household data or credentials;
- [ ] package boundaries preserved;
- [ ] behavior and failure tests added;
- [ ] docs and examples updated;
- [ ] fixture evidence distinguished from live evidence;
- [ ] formatter, typecheck, tests, and security scan pass;
- [ ] exact commit SHA recorded;
- [ ] unrelated upstream failures classified, not hidden;
- [ ] rollback or compatibility impact documented.

For the complete evidence model, see [Testing and evidence](/kaki/testing).