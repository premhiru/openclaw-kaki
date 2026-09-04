---
summary: "Install Kaki from source and verify a local Gateway."
read_when:
  - You are installing Kaki for the first time
  - You want the shortest supported setup path
title: "Kaki quickstart"
---

This guide installs Kaki from a source checkout, creates a household profile, starts the Gateway, and verifies that the local dashboard is reachable.

## Before you start

You need:

- Ubuntu/Linux or macOS; the checked-in installer rejects native Windows
- Git and Corepack
- Node.js `22.22.3–22.x`, `24.15.0–24.x`, or `25.9.0–25.x`
- a model-provider credential or supported local model
- a private location for the onboarding profile

The repository pins pnpm `12.1.0`; Corepack selects it for you.

<Warning>
The onboarding profile contains household data and SecretRefs. Keep it outside the repository, restrict its file permissions, and never attach it to an issue or commit.
</Warning>

## 1. Clone and inspect the installer

```bash

git clone https://github.com/premhiru/openclaw-kaki.git
cd openclaw-kaki
./kaki/scripts/install.sh --dry-run
```

Expected final line:

```text
Kaki installer dry run passed.
```

The dry run prints the resolved repository root and launcher path without installing packages or writing a launcher.

## 2. Install the checkout

```bash
./kaki/scripts/install.sh
```

The installer uses the frozen lockfile, builds the repository, and writes a managed launcher to `$HOME/.local/bin/kaki`. It refuses to replace a launcher it does not own.

If `$HOME/.local/bin` is not on `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Verify the launcher:

```bash
kaki --version
```

## 3. Create the private profile

Copy the safe template to a location outside the checkout:

```bash
mkdir -p "$HOME/.config/kaki"
cp kaki/examples/onboarding-profile.example.json "$HOME/.config/kaki/profile.json"
chmod 600 "$HOME/.config/kaki/profile.json"
```

Edit the placeholder IDs, household members, address, limits, and SecretRefs. Then export the referenced values in the same shell. Generate the memory key as 32 random bytes encoded with base64url:

```bash
export KAKI_MEMORY_KEY="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
export KAKI_MODEL_KEY='<model credential>'
export KAKI_LTA_KEY='<LTA credential or evaluation placeholder>'
export KAKI_ONEMAP_KEY='<OneMap credential or evaluation placeholder>'
export KAKI_PHONE_KEY='<phone pairing secret or evaluation placeholder>'
```

Do not paste the resulting values into the JSON file. See [Onboarding](/kaki/onboarding) for the field contract and alternatives to environment-backed SecretRefs.

## 4. Run onboarding

```bash
kaki onboard --classic --install-daemon \
  --kaki-profile "$HOME/.config/kaki/profile.json"
```

By default, Kaki guides WhatsApp account `assistant` and Telegram account `control`, seeds the workspace, and enables the plugin only after the profile transaction succeeds.

Useful variants:

```bash
# Configure the profile without channel setup
kaki onboard --classic --install-daemon --skip-channels \
  --kaki-profile "$HOME/.config/kaki/profile.json"

# Restore OpenClaw's full channel picker
kaki onboard --classic --install-daemon --enable-extra-channels \
  --kaki-profile "$HOME/.config/kaki/profile.json"
```

A non-interactive terminal must include `--kaki-profile`. In an interactive terminal, Kaki prompts for the completed profile path when the flag is absent.

## 5. Start and verify

Restart or run the Gateway after onboarding:

```bash
kaki gateway run
```

In another terminal:

```bash
kaki gateway status
kaki status --deep
kaki dashboard
```

Success means the Gateway status is healthy and the authenticated dashboard opens. A configured external account can still be pending or unhealthy; `status --deep` reports live owner probes rather than treating configuration as proof.

## Prove the access boundary

Open `/plugins/kaki/control` through the authenticated dashboard. The same path without valid Gateway authentication must not expose household data. Do not make the Gateway public to test this.

## If something fails

- `Node.js 22 or newer is required`: install a version in the exact supported ranges above.
- `Refusing to replace unmanaged launcher`: choose an empty absolute directory with `--bin-dir` or move the existing file yourself.
- `Kaki runtime owners are unavailable`: finish onboarding, then restart the Gateway.
- A profile field is rejected: compare it with [Onboarding](/kaki/onboarding) and the shipped example.

Continue with [Use Kaki](/kaki/using-kaki), or use [Troubleshooting](/kaki/troubleshooting) for recovery.
