---
summary: "The complete guide to installing, configuring, using, securing, and operating Kaki."
read_when:
  - You are evaluating or starting Kaki
  - You need the complete Kaki documentation map
  - You need to know what Kaki can safely do today
title: "Kaki documentation"
---

Kaki is a self-hosted Southeast Asian household agent built on OpenClaw. It combines OpenClaw's Gateway, models, channels, tools, browser, sessions, and Control UI with household onboarding, owner controls, facts-bound approvals, regional locale/data packages, and 79 maintained task playbooks.

The supported starting point is a source checkout on Ubuntu/Linux or macOS. A first local Gateway usually takes 15–30 minutes, plus model and channel authorization.

<Columns cols={2}>
  <Card title="Install and run" href="/kaki/quickstart" icon="rocket">
    Go from a reviewed source commit to an authenticated local Kaki Gateway.
  </Card>
  <Card title="Read the complete manual" href="/kaki/architecture" icon="book-open">
    Understand components, configuration, security, integrations, and operations.
  </Card>
</Columns>

## Start here

| Goal | Guide | Outcome |
| --- | --- | --- |
| Evaluate Kaki | This overview and [Known limitations](/kaki/limitations) | Accurate capability and evidence boundaries |
| Install quickly | [Quickstart](/kaki/quickstart) | Healthy local Gateway and authenticated dashboard |
| Understand the installer | [Installation](/kaki/installation) | Supported host, paths, updates, and removal |
| Prepare household data | [Onboarding](/kaki/onboarding) | Valid private profile and SecretRefs |
| Learn the system | [Architecture](/kaki/architecture) | Component, owner, state, and trust model |
| Configure a deployment | [Configuration](/kaki/configuration) | Coherent paths, references, locale, and providers |

## Use Kaki

| Goal | Guide |
| --- | --- |
| Use the dashboard and operator commands | [Use Kaki](/kaki/using-kaki) |
| Configure Telegram, WhatsApp, or other channels | [Channels](/kaki/channels) |
| Understand the regional catalogue and execution model | [Skills](/kaki/skills) |
| Review or deny a risky action | [Approvals and safety](/kaki/approvals) |
| Evaluate data, browser, phone, model, or provider readiness | [Integrations](/kaki/integrations) |
| Configure proactive household notifications | [Monitors](/kaki/monitors) |

## Operate and secure Kaki

| Goal | Guide |
| --- | --- |
| Plan an always-on host and service | [Deployment](/kaki/deployment) |
| Run health checks, backups, updates, and incidents | [Operations](/kaki/operations) |
| Apply the threat model and hardening checklist | [Security](/kaki/security) |
| Recover from a symptom | [Troubleshooting](/kaki/troubleshooting) |
| Find commands, schemas, limits, and status codes | [Reference](/kaki/reference) |

## Build and verify

| Goal | Guide |
| --- | --- |
| Change packages, UI, skills, or docs | [Development](/kaki/development) |
| Run product gates and interpret evidence | [Testing and evidence](/kaki/testing) |
| Decide whether a live workflow is supported | [Known limitations](/kaki/limitations) |

## Five-minute mental model

Kaki has five important boundaries:

1. **Launcher:** `kaki` isolates runtime state in `KAKI_HOME` (default `~/.kaki`) and forwards OpenClaw commands.
2. **Onboarding:** one validated transaction provisions the private household profile, SecretRefs, workspace, channels, and plugin references.
3. **Gateway:** OpenClaw owns authentication, models, standard channels, sessions, tools, and browser runtime.
4. **Plugin:** Kaki provides projected household state, owner-only Telegram commands, Control UI routes, skill dispatch, and approval records.
5. **External surfaces:** provider data, websites, channels, and devices need separate credentials, terms review, and live verification.

```text
operator -> authenticated Gateway -> Kaki plugin -> owner/policy -> tool or handoff
```

A configuration reference is not a credential. A fixture is not a live provider. An approval is not a receipt.

## First successful run

```bash
git clone https://github.com/premhiru/openclaw-kaki.git
cd openclaw-kaki
./kaki/scripts/install.sh --dry-run
./kaki/scripts/install.sh
```

Create the private profile from the shipped example, then:

```bash
kaki onboard --classic --install-daemon \
  --kaki-profile "$HOME/.config/kaki/profile.json"
kaki gateway status
kaki status --deep
kaki dashboard
```

Success means the Gateway is healthy and the authenticated Kaki tab loads. It does not automatically prove WhatsApp, a model, public-data credentials, or a physical Android phone. Follow [Quickstart](/kaki/quickstart) for every prerequisite and expected result.

## Capability status

| Surface | Current status | Operational meaning |
| --- | --- | --- |
| Installer and managed launcher | Implemented and CI-tested | Clean source install, frozen dependencies, build, dry run, and launcher refusal are covered on Linux/macOS |
| Profile transaction and workspace seeding | Implemented and CI-tested | Required fields and SecretRefs are validated; existing household workspace files are preserved |
| Kaki plugin, Control UI routes, and projections | Implemented with limitations | Auth and schemas are tested; some packaged edit/resume interactions remain incomplete |
| Telegram controls | Implemented and owner-gated | Kaki commands require authorized household owner; `/status` and `/approve` remain OpenClaw-owned |
| Skill catalogue and approval ledger | Implemented and fixture-tested | Plans and policy boundaries are testable; named live services still need operator evidence |
| Monitors | Evaluators/templates implemented | Provider collection, durable dedupe, quiet hours, and end-to-end notification need deployment verification |
| WhatsApp, models, LTA, OneMap, websites | Configuration/operator verification required | Credentials, terms, live availability, and account behavior are outside repository tests |
| Physical Android control | Experimental/incomplete | Packaged handler and companion command contracts do not form a supported end-to-end path |
| Pause, cost budget, quiet hours | Partial | Values can be stored/projected, but enforcement is not universal |

<Warning>
Do not give Kaki bank or Singpass credentials, reusable OTPs, production medical access, or meaningful payment authority. Use dedicated accounts, provider-side caps, and human handoff while evaluating it.
</Warning>

## Documentation conventions

- Commands assume the repository root unless stated otherwise.
- `$KAKI_HOME` means the resolved state root; default `$HOME/.kaki`.
- “Implemented” means executable code exists.
- “Fixture-tested” does not mean a live service works.
- “Operator probe” means one bounded check for an exact account/environment.
- “Owner” means the authoritative runtime component, not merely an ID in configuration.
- “Approval” means permission for exact facts, not proof of completion.

## Where engineering specifications live

The public manual under `docs/kaki/` is the operational source of truth. Engineering contracts and design rationale remain under `kaki/docs/`, including architecture, interfaces, deployment, requirements, decisions, skills, verification, and agent workbooks.

Those engineering documents may describe target architecture beyond the currently supported product. Use [Known limitations](/kaki/limitations) when deciding what is safe today.

## Get help safely

Start with [Troubleshooting](/kaki/troubleshooting). When reporting a problem, include the exact commit, OS, Node version, failed command, and sanitized status output. Exclude profiles, SecretRef values, tokens, QR codes, exact addresses, household messages, approval payloads, cookies, and raw provider responses.