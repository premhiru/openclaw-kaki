---
summary: "Understand Kaki's components, data flow, ownership boundaries, and trust model."
read_when:
  - You are evaluating how Kaki works
  - You are integrating a channel, skill, node, or operator surface
  - You need to identify which component owns a failure
title: "Kaki architecture"
---

Kaki is a household-focused distribution of OpenClaw. OpenClaw remains the runtime and control plane; Kaki adds a managed launcher, transactional household onboarding, a regional skill workspace, policy-aware owner services, and an authenticated operator surface.

## System at a glance

```text
Telegram / WhatsApp / Control UI / other OpenClaw channels
                            |
                  OpenClaw Gateway + auth
                            |
              sessions, models, tools, browser
                            |
                      Kaki plugin
          +-----------------+------------------+
          |                 |                  |
   household owners    approval ledger     skill dispatcher
          |                 |                  |
   profile + memory    facts-bound state   seeded playbooks
          +-----------------+------------------+
                            |
                 data / browser / phone surfaces
```

The Gateway owns authentication, channel connections, sessions, models, and plugin execution. Kaki does not replace those systems. It registers a plugin and supplies household-specific owners through the existing Gateway boundary.

## Components

| Component | Responsibility | Source |
| --- | --- | --- |
| Managed launcher | Isolates state, maps Kaki to OpenClaw, seeds the workspace, and forwards runtime commands | `kaki.mjs` |
| Installer | Validates the host, installs frozen dependencies, builds, and writes the launcher | `kaki/scripts/install.sh` |
| Onboarding extension | Validates the profile, resolves SecretRefs, provisions private state, and enables the plugin | `extensions/kaki/src/onboarding-*` |
| Kaki plugin | Registers the Control UI, HTTP handlers, Telegram commands, and optional skill tool | `extensions/kaki` |
| Runtime owners | Adapt Kaki operations onto authoritative OpenClaw or package services | `extensions/kaki/src/host-owners.ts` |
| Approval ledger | Stores pending decisions and enforces ID, actor, facts-hash, expiry, and single-use checks | `extensions/kaki/src/approval-ledger.ts` |
| Regional packages | Locale, memory, models, data, browser, phone, security, and skills | `kaki/packages` |
| Control UI | Presents bounded household projections and operator actions | `kaki/apps/control-ui` |

## Startup sequence

1. The launcher resolves `KAKI_HOME` and maps it to OpenClaw state, config, and workspace paths.
2. It disables update telemetry for the Kaki process.
3. Onboarding validates the household transaction and writes only non-secret plugin references into `kaki.json`.
4. Workspace seeding adds `SOUL.md` and maintained skills only when the destination file does not already exist.
5. The Gateway loads the Kaki plugin.
6. The plugin resolves runtime owners. Until they are available, operator routes return a clear `503` or unavailable message.
7. Authenticated operators use the Control UI or owner-only Telegram commands.

## Household boundary

A Kaki installation is designed around one household profile and one configured operator. The operator ID must also exist in the member list. Household data is stored under the selected `KAKI_HOME`; using separate homes is the practical isolation boundary for separate deployments.

The plugin exposes projections rather than raw internal objects. Requests flow through Gateway authentication and declared scopes. Telegram commands additionally require an authorized sender marked as the household owner.

<Warning>
A valid identifier is a reference, not proof of isolation or authorization. Use separate credentials and state directories, test non-owner rejection, and never expose the Gateway publicly.
</Warning>

## Request flow

For an ordinary operator action:

1. the Gateway authenticates the request or channel sender;
2. the plugin applies method, content-type, size, intent-header, and concurrency guards;
3. the action body is parsed with exact keys and bounded values;
4. the plugin calls the authoritative runtime owner with a deadline;
5. the owner returns a projected result;
6. the HTTP route reads a fresh snapshot and returns both result and state.

Unsupported or over-broad fields are rejected. A successful HTTP response proves that the owner accepted the action; for incomplete surfaces, it does not prove that an external side effect completed.

## Approval flow

Risky skills stop before their declared commit step. The approval record binds:

- approval ID;
- household and task context;
- operator identity;
- material facts represented by a SHA-256 facts hash;
- expiration time;
- decision and single-use state.

An approval is valid only if the current ID and facts hash match, the actor is authorized, the record is pending, and it has not expired. Concurrent or stale decisions return a conflict and require a refreshed snapshot. See [Approvals and safety](/kaki/approvals).

## Workspace seeding

Onboarding copies the Kaki persona and regional `SKILL.md` playbooks into the OpenClaw workspace. Existing destination files are preserved. This makes household edits durable across later onboarding runs, but it also means repository updates do not silently replace customized copies.

Review upstream changes before manually reconciling a customized skill or `SOUL.md`.

## Execution surfaces

Kaki's contracts describe four surface categories:

- **API/data:** structured provider or public-data calls;
- **browser:** web workflows through OpenClaw's browser owner;
- **phone:** bounded device commands;
- **approval:** a human decision before a material action.

The catalogue describes intended steps and risk boundaries. A checked-in playbook or fixture is not proof that a current external account, portal, or physical phone works. See [Integrations](/kaki/integrations) and [Known limitations](/kaki/limitations).

## Repository map

```text
kaki.mjs                         managed launcher
KAKI.md                          repository entry point
extensions/kaki/                 OpenClaw plugin integration
kaki/apps/control-ui/            packaged operator UI
kaki/examples/                   safe onboarding example
kaki/packages/                   Kaki libraries and playbooks
kaki/scripts/                    installer and validation utilities
kaki/tests/                      product and QA coverage
kaki/docs/                       engineering specifications
kaki/evals/                      deterministic evaluation fixtures
docs/kaki/                       public user and operator manual
```

## Failure ownership

| Symptom | Likely owner |
| --- | --- |
| Launcher or source install fails | Kaki installer/launcher |
| Gateway cannot start or authenticate | OpenClaw Gateway |
| Model or standard channel is unavailable | OpenClaw provider/channel owner |
| Kaki tab returns `503` | Kaki runtime-owner resolution |
| Kaki action returns `400` | Kaki request schema or intent guard |
| Approval returns `409` | Kaki approval ledger; refresh facts |
| External website or device fails | Browser, phone, provider, or account boundary |

## Design versus released capability

Engineering specifications under `kaki/docs/` describe the intended architecture and contracts. Public support claims are narrower: they require implemented code plus appropriate fixture, clean-install, or live evidence. Always use [Known limitations](/kaki/limitations) as the release boundary.