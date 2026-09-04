---
summary: "Kaki CLI, state, configuration, Telegram, and HTTP reference."
read_when:
  - You need exact Kaki commands or limits
  - You are integrating with the Kaki control API
title: "Kaki reference"
---

## Launcher and state

| Item                                  | Default                               |
| ------------------------------------- | ------------------------------------- |
| Launcher                              | `$HOME/.local/bin/kaki`               |
| State                                 | `${KAKI_HOME:-$HOME/.kaki}`           |
| Config                                | `${KAKI_HOME:-$HOME/.kaki}/kaki.json` |
| Workspace                             | `${KAKI_HOME:-$HOME/.kaki}/workspace` |
| Timezone used by Kaki locale/monitors | `Asia/Singapore`                      |

The launcher maps Kaki state into the OpenClaw runtime and disables OpenClaw update checks, usage reporting, and OpenTelemetry for that process.

## Installation

```bash
./kaki/scripts/install.sh [--dry-run] [--bin-dir <absolute-directory>]
```

The installer supports Linux and macOS, uses the root frozen lockfile, builds the repository, and writes only a managed launcher. The repository pins pnpm `12.1.0`.

## Onboarding and runtime

```bash
kaki onboard --classic --install-daemon --kaki-profile <absolute-path>
kaki onboard --classic --install-daemon --skip-channels --kaki-profile <absolute-path>
kaki onboard --classic --install-daemon --enable-extra-channels --kaki-profile <absolute-path>
kaki gateway run
kaki gateway status
kaki status --deep
kaki status --deep --json
kaki dashboard
kaki wa relink [--account <id>] [--verbose]
```

`--kaki-profile` is required without a TTY. With a TTY, Kaki prompts for the completed JSON path if it is absent.

## Plugin configuration

The enabled plugin config contains non-secret references only:

```json
{
  "householdProfileId": "household-primary",
  "operatorPersonId": "person-operator",
  "addressBookProfileId": "addresses-primary",
  "approvalPolicyProfileId": "approval-primary",
  "dataProfileId": "data-primary",
  "phoneNodeId": "phone-primary",
  "whatsappAccountId": "assistant",
  "telegramAccountId": "control",
  "modelProfileId": "model-primary",
  "asrProfileId": "asr-primary",
  "locale": "sg"
}
```

Every ID must be non-empty, trimmed, and at most 128 characters. Locale is one of `sg`, `my`, `id`, `th`, `vn`, `ph`, `mm`, or `kh`.

The private onboarding profile adds household members, addresses, caps, monitor session, and exactly five `{source, provider, id}` SecretRefs. See [Onboarding](/kaki/onboarding).

## Telegram commands

Kaki registers owner-authenticated `/deny`, `/relink-wa`, `/journey`, `/household`, `/phone`, `/skills`, `/cron`, `/locale`, `/pause`, `/resume`, and `/cost` commands. OpenClaw owns `/status` and `/approve`.

See [Use Kaki](/kaki/using-kaki) for arguments and behavior.

## HTTP control API

The routes are available through the authenticated Gateway and are intended for the packaged Control UI.

### Snapshot

```http
GET /api/kaki/snapshot
```

- Gateway authentication required
- `Cache-Control: no-store`
- maximum response: 1 MB
- owner deadline applies

### Action

```http
POST /api/kaki/action
Content-Type: application/json
X-Kaki-Intent: operator-action
```

- Gateway authentication required
- maximum request body: 100,000 bytes
- body read timeout: 5 seconds
- maximum eight requests in flight
- returns `409` when approval facts changed
- returns `429` at the concurrency limit

Supported action types are:

- `system.pause`
- `approval.decide`
- `household.edit`
- journey create, edit, and delete
- `phone.command`
- `skill.save-draft`
- `locale.set`
- `trace.position`
- `monitor.set`

The presence of an action schema does not guarantee every packaged UI interaction is complete. Check [Known limitations](/kaki/limitations) before building an operator procedure around it.

## Approval properties

Implemented Kaki approval grants are bound to an approval ID and facts hash, restricted to the operator, single-use, compare-and-swap protected, and expire after two hours by default. A stale decision returns a conflict and requires a new snapshot.
