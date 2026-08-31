[kaki/docs/ONBOARDING.md, # Onboard a household

This is the repository-facing onboarding contract. For the task-first operator guide, expected results, and recovery paths, see [Kaki onboarding](../../docs/kaki/onboarding.md).

## Requirements

Use Ubuntu/Linux or macOS with Corepack and Node.js `22.22.3–22.x`, `24.15.0–24.x`, or `25.9.0–25.x`. The repository pins pnpm `12.1.0`.

Keep the private profile outside the checkout. Never place provider keys, QR codes, pairing secrets, OTPs, bank credentials, or Singpass credentials in Git, chat, screenshots, or issue logs.

## Install the source checkout

```bash
./kaki/scripts/install.sh --dry-run
./kaki/scripts/install.sh
```

The installer checks the host, installs the frozen dependency graph, builds the repository, and writes a managed launcher to `$HOME/.local/bin/kaki` by default. It refuses to overwrite an unrelated executable. `--bin-dir` accepts an alternate absolute destination.

## Prepare the private profile

```bash
mkdir -p "$HOME/.config/kaki"
cp kaki/examples/onboarding-profile.example.json "$HOME/.config/kaki/profile.json"
chmod 600 "$HOME/.config/kaki/profile.json"
```

Replace all example IDs and household data. The operator ID must match a member. Addresses must be confirmed by the operator. The locale is one of `sg`, `my`, `id`, `th`, `vn`, `ph`, `mm`, or `kh`.

The file contains exactly five SecretRefs: `householdMemoryKey`, `model`, `ltaDataMall`, `oneMap`, and `phonePairing`. A reference is `{source, provider, id}` with source `env`, `file`, `exec`, or `store`; every reference must resolve during onboarding. The memory key must resolve to 32 random bytes encoded as unpadded base64url.

For the environment-backed example:

```bash
export KAKI_MEMORY_KEY="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
export KAKI_MODEL_KEY='<model credential>'
export KAKI_LTA_KEY='<LTA credential or evaluation placeholder>'
export KAKI_ONEMAP_KEY='<OneMap credential or evaluation placeholder>'
export KAKI_PHONE_KEY='<phone pairing secret or evaluation placeholder>'
```

These environment values belong to the onboarding process, not the JSON file.

## Run canonical onboarding

```bash
kaki onboard --classic --install-daemon \
  --kaki-profile "$HOME/.config/kaki/profile.json"
```

Without a TTY, `--kaki-profile` is required. With a TTY, Kaki prompts for the path if it is absent.

The default flow narrows channel setup to WhatsApp account `assistant` and Telegram account `control`. Use `--enable-extra-channels` for OpenClaw's full picker or `--skip-channels` to defer channel setup.

Kaki disables the plugin while it runs OpenClaw onboarding, seeds `SOUL.md` and the maintained skills without overwriting existing files, provisions the private encrypted profile, then enables the plugin with non-secret references. Restart the Gateway after success.

If validation or a required owner write fails, correct the named surface and rerun the same command. Do not use reset as a generic repair.

## Verify

```bash
kaki gateway status
kaki status --deep
kaki dashboard
```

A healthy local Gateway and authenticated `/plugins/kaki/control` tab prove the local runtime path. External accounts and devices require separate bounded probes. Fixtures do not prove live WhatsApp, Gmail, LTA, OneMap, model-provider, Grab, Singpass, banking, government-portal, or physical-phone readiness.

## Operational cautions

- The Kaki `/pause` value is not enforced across every skill and monitor path.
- Cost and monthly budget values are not complete billing or hard limits.
- Quiet hours are not currently enforced.
- The packaged Android handler and separate Kaki companion do not yet provide a supported end-to-end phone-control contract.
- OpenClaw owns `/status` and `/approve`; Kaki registers `/deny` but not a separate `/approve` command.

Read [Known limitations](../../docs/kaki/limitations.md) before live testing and [Troubleshooting](../../docs/kaki/troubleshooting.md) before deleting or resetting state.].Value