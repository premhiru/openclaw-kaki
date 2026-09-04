---
summary: "Complete Kaki command, environment, profile, Telegram, HTTP action, limit, and status-code reference."
read_when:
  - You need an exact Kaki command or limit
  - You are integrating with the authenticated Kaki control surface
  - You need profile, locale, action, or status-code details
title: "Kaki reference"
---

## Versions and platforms

| Item                      | Value                                            |
| ------------------------- | ------------------------------------------------ |
| Kaki workspace version    | `0.9.0`                                          |
| Supported installer hosts | Ubuntu/Linux and macOS                           |
| Native Windows installer  | Unsupported                                      |
| Node.js                   | `22.22.3–22.x`, `24.15.0–24.x`, or `25.9.0–25.x` |
| pnpm                      | Repository-pinned `12.1.0` through Corepack      |

## Paths and environment

| Item                     | Default                               |
| ------------------------ | ------------------------------------- |
| Managed launcher         | `$HOME/.local/bin/kaki`               |
| State root               | `${KAKI_HOME:-$HOME/.kaki}`           |
| Gateway config           | `${KAKI_HOME:-$HOME/.kaki}/kaki.json` |
| Workspace                | `${KAKI_HOME:-$HOME/.kaki}/workspace` |
| Current monitor timezone | `Asia/Singapore`                      |

The launcher sets `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, and `OPENCLAW_WORKSPACE_DIR` from `KAKI_HOME` only when those variables are not already set. It disables automatic update checks, usage reporting, and OpenTelemetry for the Kaki process.

## Installer

```bash
./kaki/scripts/install.sh [--dry-run] [--bin-dir <absolute-directory>]
```

- `--dry-run`: validate and print the plan without dependency installation or launcher write.
- `--bin-dir`: use another absolute managed-launcher directory.

The installer uses the root frozen lockfile and refuses to replace an unmanaged launcher.

## Onboarding

Canonical command:

```bash
kaki onboard --classic --install-daemon --kaki-profile <absolute-path>
```

Variants:

```bash
kaki onboard --classic --install-daemon --skip-channels \
  --kaki-profile <absolute-path>

kaki onboard --classic --install-daemon --enable-extra-channels \
  --kaki-profile <absolute-path>
```

`--kaki-profile` is required without a TTY. In an interactive terminal Kaki prompts for the completed profile path. Default narrowed channel IDs are WhatsApp `assistant` and Telegram `control`.

## Runtime commands

```bash
kaki --help
kaki --version
kaki gateway run
kaki gateway status
kaki status --deep
kaki status --deep --json
kaki dashboard
kaki config path
kaki wa relink [--account <id>] [--verbose]
```

Except for Kaki-specific onboarding, workspace seeding, deep-status composition, help, and `wa relink`, the managed launcher forwards commands to OpenClaw with Kaki's isolated state environment.

## Plugin configuration

The enabled Kaki plugin requires exactly these non-secret references:

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

Reference rules:

- string;
- trimmed and non-empty;
- maximum 128 characters;
- locale is one of `sg`, `my`, `id`, `th`, `vn`, `ph`, `mm`, `kh`.

## Private profile limits

| Field                   | Limit/rule                                          |
| ----------------------- | --------------------------------------------------- |
| `members`               | 1–100; operator ID must match a member ID           |
| `addresses`             | 1–32                                                |
| Address label           | `home`, `office`, or `school`                       |
| `approvalAutoCap`       | Non-negative                                        |
| `approvalCurrency`      | Use `SGD` for the implemented known-payee cap path  |
| `monthlyModelBudgetUsd` | Recorded projection, not universal hard enforcement |
| `secretRefs`            | Exactly five resolvable references                  |

Required SecretRef keys: `householdMemoryKey`, `model`, `ltaDataMall`, `oneMap`, and `phonePairing`. Supported sources: `env`, `file`, `exec`, `store`.

## Telegram commands

| Command                            | Owner         | Scope            |
| ---------------------------------- | ------------- | ---------------- |
| `/status`                          | OpenClaw host | Host-defined     |
| `/approve`                         | OpenClaw host | Host-defined     |
| `/deny <approval-id> <facts-hash>` | Kaki          | `operator.write` |
| `/relink-wa`                       | Kaki          | `operator.admin` |
| `/journey`                         | Kaki          | `operator.read`  |
| `/household`                       | Kaki          | `operator.read`  |
| `/phone screenshot`                | Kaki          | `operator.write` |
| `/phone tap <visible-target>`      | Kaki          | `operator.write` |
| `/skills`                          | Kaki          | `operator.read`  |
| `/cron`                            | Kaki          | `operator.read`  |
| `/locale [code]`                   | Kaki          | `operator.write` |
| `/pause`, `/resume`                | Kaki          | `operator.write` |
| `/cost`                            | Kaki          | `operator.read`  |

Kaki commands are Telegram-only, require channel authentication, and require the sender to be the household owner. List responses show at most 20 rows and are capped at 4,000 characters.

## HTTP control surface

These internal routes are mounted through the authenticated Gateway for the packaged UI.

### Snapshot

```http
GET /api/kaki/snapshot
```

- Gateway authentication required;
- only `GET` accepted;
- `Cache-Control: no-store`;
- JSON response capped at 1,000,000 bytes;
- shares the eight-request concurrency limiter;
- owner deadline applies.

### Action

```http
POST /api/kaki/action
Content-Type: application/json
X-Kaki-Intent: operator-action
```

- Gateway authentication and appropriate scope required;
- only `POST` accepted;
- exact intent header required;
- body capped at 100,000 bytes;
- body read timeout 5 seconds;
- maximum eight requests in flight;
- exact action keys required; unknown/extra keys are rejected.

## Action schemas

### Pause projection

```json
{ "type": "system.pause", "paused": true }
```

### Approval decision

```json
{
  "type": "approval.decide",
  "id": "approval-id",
  "decision": "denied",
  "factsHash": "64-lowercase-hex-characters"
}
```

`decision` is `approved` or `denied`.

### Household edit

```json
{
  "type": "household.edit",
  "id": "member-id",
  "patch": { "register": "clear Singapore English" }
}
```

Allowed patch keys: `name`, `relation`, `languages`, `register`, `dietary`, `commute`. Patch must be non-empty. Text/list bounds apply.

### Journey create

```json
{
  "type": "journey.create",
  "input": {
    "taskId": "task-id",
    "title": "Short title",
    "detail": "Detail"
  }
}
```

Title maximum 512 characters; detail maximum 16,384.

### Journey edit

```json
{
  "type": "journey.edit",
  "id": "journey-id",
  "patch": { "title": "Updated title" }
}
```

Patch supports `title` and `detail` and must be non-empty.

### Journey delete

```json
{ "type": "journey.delete", "id": "journey-id" }
```

### Phone command

```json
{ "type": "phone.command", "command": "screenshot" }
```

Commands: `screenshot`, `back`, `home`, `tap-target`, `refresh-tree`, `relaunch`. `tap-target` may include `target`; physical Android support is incomplete.

### Save skill draft

```json
{
  "type": "skill.save-draft",
  "id": "draft-id",
  "instructions": "Draft instructions"
}
```

Instructions maximum 64,000 characters.

### Set locale

```json
{ "type": "locale.set", "locale": "sg" }
```

### Trace position

```json
{ "type": "trace.position", "id": "trace-id", "step": 0 }
```

Step is a safe integer from 0 through 10,000.

### Monitor state

```json
{ "type": "monitor.set", "id": "monitor-id", "enabled": true }
```

General identifiers are non-empty strings no longer than 256 characters.

## HTTP responses

|      Status | Meaning                                                                    |
| ----------: | -------------------------------------------------------------------------- |
|       `200` | Snapshot/action owner completed; action response includes a fresh snapshot |
|       `400` | Missing intent, invalid JSON, or unsupported/excess action schema          |
| `401`/`403` | Gateway authentication or scope rejected                                   |
|       `405` | Method rejected by request guard                                           |
|       `409` | Approval facts/status changed; refresh before deciding                     |
|       `413` | Body exceeded request limit                                                |
|       `415` | JSON content type required                                                 |
|       `429` | More than eight Kaki control requests in flight                            |
|       `503` | Runtime owners unavailable or owner call failed                            |
|       `502` | Owner projection exceeded the 1 MB response limit                          |

Exact request-guard status behavior is inherited from the OpenClaw webhook guard implementation.

## Approval guarantees

Implemented grants are bound to approval ID and SHA-256 facts hash, restricted to the operator, compare-and-swap protected, single-use, and expire after two hours by default. A stale decision must be refreshed, not replayed.

## Product verification commands

```bash
pnpm --dir kaki lint
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

See [Testing and evidence](/kaki/testing) before interpreting a green result as live-service readiness.
