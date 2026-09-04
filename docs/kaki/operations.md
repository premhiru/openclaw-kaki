---
summary: "Operate, back up, update, and recover a Kaki Gateway."
read_when:
  - You operate an installed Kaki Gateway
  - You are updating or recovering Kaki
title: "Operate Kaki"
---

Kaki keeps its state separate from the default OpenClaw state. Unless `KAKI_HOME` is set, the launcher uses:

- state: `~/.kaki`
- config: `~/.kaki/kaki.json`
- workspace: `~/.kaki/workspace`

## Routine health check

```bash
kaki gateway status
kaki status --deep
```

Use `kaki status --deep --json` when you need structured output. Treat a configured external surface as pending until its live owner probe succeeds.

For the dashboard:

```bash
kaki dashboard
```

## Back up state

Stop the Gateway using the service method chosen during OpenClaw onboarding. Then copy the entire resolved `KAKI_HOME` to encrypted storage. Preserve file permissions and include `kaki.json`, the private profile state, approval records, and the workspace.

Before relying on the backup, inspect the destination without printing file contents and record the source commit:

```bash
git rev-parse HEAD
ls -ld "${KAKI_HOME:-$HOME/.kaki}"
```

A backup can contain household data and credentials managed by the configured SecretRef providers. Protect it accordingly.

## Update

From the source checkout:

```bash
git fetch --all --prune
git pull --ff-only
./kaki/scripts/install.sh
```

Restart the Gateway, then repeat the health check. The installer rebuilds the checkout and updates only its managed launcher.

## Roll back

1. Stop the Gateway.
2. Check out the previously recorded known-good commit in the source checkout.
3. Run `./kaki/scripts/install.sh` again.
4. Restore state only if the release notes or a failed migration require it.
5. Restart and run `kaki status --deep`.

Do not delete `KAKI_HOME` as a repair shortcut. Preserve the failed state until you have diagnostics and a verified backup.

## Configuration changes

Rerun the canonical onboarding command when household references or core channel choices change:

```bash
kaki onboard --classic --install-daemon \
  --kaki-profile /protected/path/profile.json
```

Onboarding preserves existing seeded workspace files. Use explicit OpenClaw configuration commands for unrelated Gateway settings; Kaki and OpenClaw share the runtime but keep separate state through the launcher.

## Incident checklist

1. Prevent new risky work through the channel or service boundary you control. The current Kaki pause flag is not a complete kill switch.
2. Capture the exact source commit, `kaki gateway status`, and sanitized `kaki status --deep --json` output.
3. Revoke or rotate a credential at its authoritative provider if exposure is possible.
4. Preserve approval records and relevant logs without copying secrets or household message bodies into public issues.
5. Roll back only after preserving evidence and confirming the target commit.

For symptom-first recovery, use [Troubleshooting](/kaki/troubleshooting). For acceptance and live-evidence boundaries, see [Known limitations](/kaki/limitations).
