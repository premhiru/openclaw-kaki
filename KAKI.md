# Kaki

Kaki is a self-hosted household agent for Southeast Asia, built on the complete OpenClaw runtime. It adds a private household profile, regional skill catalogue, operator controls, approval records, and locale packs while OpenClaw provides the Gateway, authentication, models, channels, sessions, and Control UI.

## Start here

- [Kaki overview](docs/kaki/index.md) — mental model and tested-capability matrix
- [Quickstart](docs/kaki/quickstart.md) — source install to verified Gateway
- [Onboard a household](docs/kaki/onboarding.md) — private profile and SecretRefs
- [Use Kaki](docs/kaki/using-kaki.md) — dashboard, Telegram commands, skills, and approvals
- [Operations](docs/kaki/operations.md) — health, backups, updates, and rollback
- [Troubleshooting](docs/kaki/troubleshooting.md) — symptom-first recovery
- [Reference](docs/kaki/reference.md) — CLI, config, and HTTP limits
- [Known limitations](docs/kaki/limitations.md) — exact live-evidence boundaries

## Ten-minute local proof

On Ubuntu/Linux or macOS with a supported Node.js version:

```bash
git clone https://github.com/premhiru/openclaw-kaki.git
cd openclaw-kaki
./kaki/scripts/install.sh --dry-run
./kaki/scripts/install.sh
```

Create a private profile from `kaki/examples/onboarding-profile.example.json`, export the five referenced secrets, then run:

```bash
kaki onboard --classic --install-daemon \
  --skip-channels \
  --kaki-profile /protected/path/profile.json
kaki gateway status
kaki status --deep
kaki dashboard
```

This proves the source installation, profile transaction, local Gateway, and authenticated UI path. It does not prove a live channel, third-party provider, or physical Android device. Follow the [Quickstart](docs/kaki/quickstart.md) for exact requirements, expected results, and recovery.

## State boundary

The `kaki` launcher keeps state separate from the default OpenClaw installation:

- state: `${KAKI_HOME:-$HOME/.kaki}`
- config: `${KAKI_HOME:-$HOME/.kaki}/kaki.json`
- workspace: `${KAKI_HOME:-$HOME/.kaki}/workspace`

The upstream-compatible `openclaw` launcher remains available for diagnostics and upstream maintenance.

## Safety boundary

Do not give Kaki bank credentials, Singpass credentials, reusable OTPs, production medical access, or meaningful payment authority. Use dedicated accounts, minimal permissions, provider-side caps, and bounded live probes.

Repository tests cover deterministic contracts. Live release evidence is tracked separately; read [Known limitations](docs/kaki/limitations.md) before relying on WhatsApp, Gmail, Grab, government portals, provider data, cost budgets, pause behavior, or phone automation.
