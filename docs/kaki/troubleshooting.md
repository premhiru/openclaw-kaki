[docs/kaki/troubleshooting.md, ---
summary: "Recover from Kaki installation, onboarding, Gateway, and control failures."
read_when:
  - Kaki installation or onboarding failed
  - A Kaki control surface is unavailable
title: "Troubleshoot Kaki"
---

Start with the smallest read-only checks:

```bash
kaki --version
kaki gateway status
kaki status --deep
```

Do not delete `~/.kaki`, reset onboarding, or rotate every credential before identifying the failing boundary.

## Installer fails

### Node version is rejected

The repository supports Node.js `22.22.3–22.x`, `24.15.0–24.x`, or `25.9.0–25.x`.

```bash
node --version
corepack --version
```

Switch to a supported version and rerun `./kaki/scripts/install.sh --dry-run`.

### Installer refuses the launcher

```text
Refusing to replace unmanaged launcher
```

The destination already contains a file the installer does not own. Inspect it, then either move it yourself or choose an empty absolute directory:

```bash
./kaki/scripts/install.sh --bin-dir "$HOME/.local/kaki-bin"
```

Add that directory to `PATH`. Kaki never removes the unrelated file for you.

### Native Windows is rejected

The source installer supports Linux and macOS. Use a supported host for this acceptance path; do not treat a hand-written Windows launcher as equivalent evidence.

## Onboarding fails

### A profile field is invalid

Compare your private file with `kaki/examples/onboarding-profile.example.json` and [the profile contract](/kaki/onboarding). Frequent causes are:

- the operator ID does not match a member
- an unsupported locale
- a missing one of the eleven config references
- a SecretRef value that does not resolve in the onboarding process
- a memory key that is not 32-byte base64url

Correct the named field and rerun the same onboarding command. A failed transaction should not be reported as a healthy enabled plugin.

### Non-interactive onboarding asks for a profile

Pass the path explicitly:

```bash
kaki onboard --classic --install-daemon \
  --kaki-profile /protected/path/profile.json
```

### A channel is not ready

Rerun onboarding with `--skip-channels` to prove the local household/runtime path first. Then configure one channel at a time and use its live status probe. QR scans, bot tokens, allowlists, provider terms, and third-party outages are outside fixture evidence.

## Gateway or controls fail

### Runtime owners are unavailable

```text
Kaki runtime owners are unavailable. Finish `kaki onboard`, then restart the Gateway.
```

Confirm the profile transaction completed, restart the Gateway, and run `kaki status --deep`. If it persists, inspect whether the Kaki plugin is enabled with all required non-secret config references.

### The Kaki tab returns 401 or 403

Use the URL opened by `kaki dashboard` and authenticate to the Gateway. The control route requires Gateway auth and `operator.write` scope. Do not weaken authentication or expose the Gateway publicly to bypass the error.

### An action returns 400

Kaki actions require JSON and the exact header:

```text
X-Kaki-Intent: operator-action
```

A 400 also means the body did not match a supported action schema. See [HTTP reference](/kaki/reference#http-control-api).

### An action returns 409

The approval changed after the snapshot was read. Refresh the snapshot and compare the new approval ID and facts hash. Never retry a stale approval blindly.

### An action returns 429

The control API allows eight concurrent requests. Wait briefly and retry once; investigate a looping client if it recurs.

### Phone command is unavailable

Current physical Android integration is incomplete: the packaged Android handler and the Kaki companion use different command contracts. Treat screenshot/tap results as experimental and do not test on banking, wallet, Singpass, or medical screens.

## Collect a safe report

Include:

- source commit from `git rev-parse HEAD`
- operating system and `node --version`
- the command that failed
- sanitized `kaki gateway status` and `kaki status --deep --json`
- whether the failure reproduces with channels skipped

Exclude profile contents, SecretRef values, QR codes, tokens, household messages, exact private addresses, approval payloads, and raw provider responses.].Value