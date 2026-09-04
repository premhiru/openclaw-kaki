---
summary: "Configure Kaki paths, profiles, SecretRefs, plugin references, locales, and channels."
read_when:
  - You need to understand every Kaki configuration layer
  - You are moving state or changing a household profile
  - A configured integration is not becoming ready
title: "Configure Kaki"
---

Kaki configuration has three layers: launcher environment, OpenClaw Gateway configuration, and the private household profile. Keep them separate. Environment variables select storage and resolve secrets; `kaki.json` configures the Gateway and contains non-secret references; encrypted Kaki state contains the validated household profile.

## Configuration precedence

1. Environment variables present in the `kaki` process
2. Values written by OpenClaw/Kaki onboarding to `$KAKI_HOME/kaki.json`
3. Launcher defaults

Kaki does not load an arbitrary `.env` file as an authoritative secret store. Make secrets available to the service process through the SecretRef mechanism you selected.

## Launcher environment

| Variable                 | Purpose                      | Default when using `kaki` |
| ------------------------ | ---------------------------- | ------------------------- |
| `KAKI_HOME`              | Root of this Kaki deployment | `$HOME/.kaki`             |
| `OPENCLAW_STATE_DIR`     | OpenClaw state used by Kaki  | `$KAKI_HOME`              |
| `OPENCLAW_CONFIG_PATH`   | Gateway configuration        | `$KAKI_HOME/kaki.json`    |
| `OPENCLAW_WORKSPACE_DIR` | Persona and seeded skills    | `$KAKI_HOME/workspace`    |

The launcher sets the three OpenClaw variables only when they are not already set. Avoid mixing an explicit `OPENCLAW_STATE_DIR` with an unrelated `KAKI_HOME`; choose one coherent state root.

Example service-specific state:

```bash
export KAKI_HOME="/srv/kaki/household-primary"
kaki config path
kaki gateway status
```

## Plugin configuration

Onboarding writes these eleven values to the enabled Kaki plugin entry:

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

Every reference must be trimmed, non-empty, and no longer than 128 characters. Supported locale codes are `sg`, `my`, `id`, `th`, `vn`, `ph`, `mm`, and `kh`.

These values identify configuration owners. They are not credentials and are not proof that an owner is connected. Several reference types are not yet wired to live runtime owners; verify with `kaki status --deep` and a bounded probe.

## Household profile

The private onboarding document adds:

- household and operator display names;
- 1–100 household members;
- 1–32 confirmed addresses;
- approval currency and automatic cap;
- recorded monthly model budget;
- monitor announcement session;
- exactly five SecretRefs.

Start from `kaki/examples/onboarding-profile.example.json`. See [Onboard a household](/kaki/onboarding) for every field rule.

## SecretRefs

A SecretRef is a locator:

```json
{
  "source": "env",
  "provider": "default",
  "id": "KAKI_MODEL_KEY"
}
```

Supported sources are:

| Source  | Meaning                                      | Operational requirement                                        |
| ------- | -------------------------------------------- | -------------------------------------------------------------- |
| `env`   | Read from the onboarding/service environment | Inject without printing; persist securely for service restarts |
| `file`  | Read from a protected file                   | Restrict owner and mode; keep outside the repository           |
| `exec`  | Resolve through an approved command          | Pin the executable and protect its output                      |
| `store` | Resolve through the configured secret store  | Configure and test the store before onboarding                 |

The five required names are `householdMemoryKey`, `model`, `ltaDataMall`, `oneMap`, and `phonePairing`. Every reference must resolve during onboarding. An evaluation placeholder can satisfy structure but must never be described as a live integration.

The household memory key must be 32 random bytes encoded as unpadded base64url:

```bash
export KAKI_MEMORY_KEY="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
```

<Warning>
Never put the resolved value in the profile, `kaki.json`, a shell history entry, a GitHub issue, or a diagnostic bundle. Kaki needs bank and identity handoffs—not bank passwords, Singpass credentials, or reusable OTPs.
</Warning>

## Locale configuration

The active locale controls language assets, currency projection, and regional skill availability. Change it through the authenticated owner surface:

```text
/locale
/locale my
```

Or use the Control API `locale.set` action. Confirm the returned snapshot. Myanmar and Cambodia packs are conservative stubs, and monitors currently use `Asia/Singapore` regardless of locale.

## Channel configuration

The Kaki onboarding path defaults to:

- WhatsApp account ID `assistant`;
- Telegram account ID `control`.

Use `--skip-channels` to configure household state first, or `--enable-extra-channels` to restore OpenClaw's complete channel picker. Channel tokens and session data remain owned by OpenClaw's channel integrations.

A configured account ID does not prove login, allowlisting, provider terms, or delivery. Verify each channel separately as described in [Channels](/kaki/channels).

## Model and ASR references

`modelProfileId` and `asrProfileId` are non-secret references. Model credentials are resolved through the corresponding SecretRef/provider configuration. Use OpenClaw's model status and a harmless prompt to prove the selected model. Use a non-sensitive audio sample to verify ASR.

The recorded `monthlyModelBudgetUsd` is not a hard limit across all model execution. Configure provider-side caps and alerts.

## Make a safe change

1. record the source commit and current `KAKI_HOME`;
2. stop or restrict risky work at an enforceable boundary;
3. create a protected backup;
4. update the private profile outside the repository;
5. rerun the canonical onboarding command;
6. restart the Gateway;
7. run `kaki status --deep --json`;
8. verify non-owner rejection and one bounded integration probe.

Onboarding preserves existing seeded workspace files. It does not overwrite household-customized `SOUL.md` or skill files.

## Validate without exposing values

```bash
kaki config path
kaki gateway status
kaki status --deep --json
```

Sanitize structured output before sharing it. Do not print environment variables, profile contents, tokens, exact private addresses, channel QR codes, or approval material facts.

## Common mistakes

| Mistake                                       | Consequence                                                    |
| --------------------------------------------- | -------------------------------------------------------------- |
| Putting a secret directly in JSON             | Credential becomes copyable configuration data                 |
| Changing an ID without provisioning its owner | Config parses but runtime owner stays unavailable              |
| Sharing one `KAKI_HOME` between Gateways      | State and service contention                                   |
| Treating a valid SecretRef as a live probe    | False readiness claim                                          |
| Rerunning onboarding to repair every failure  | Unnecessary state changes; diagnose the failing boundary first |

Use [Troubleshooting](/kaki/troubleshooting) when a validated configuration does not become healthy.
