---
summary: "Install, update, relocate, or remove Kaki from a supported source checkout."
read_when:
  - You need the complete installation contract
  - You are choosing a host, Node version, or KAKI_HOME
  - You need to update or remove a managed launcher
title: "Install Kaki"
---

Kaki is installed from this repository. The installer verifies the host and launcher, installs the frozen workspace dependencies, builds the project, and creates a small managed launcher. It does not publish or install a separate Kaki package from npm.

## Supported environment

| Requirement      | Supported contract                                |
| ---------------- | ------------------------------------------------- |
| Operating system | Ubuntu/Linux or macOS                             |
| Native Windows   | Not supported by the checked-in installer         |
| Node.js          | `22.22.3–22.x`, `24.15.0–24.x`, or `25.9.0–25.x`  |
| Package manager  | Corepack with the repository-pinned pnpm `12.1.0` |
| Source control   | Git                                               |
| Default launcher | `$HOME/.local/bin/kaki`                           |
| Default state    | `$HOME/.kaki`                                     |

The Node ranges match the repository runtime gate. A higher major version is not automatically supported.

<Note>
Kaki inherits OpenClaw's model, Gateway, and channel requirements. Installation proves that the local software builds; it does not authorize a model or messaging account.
</Note>

## Choose the host

Use a host you control and keep patched. The default deployment is a single trusted machine running the Gateway and Control UI. Do not expose the Gateway, browser debugging port, Android Debug Bridge, or model endpoint directly to the public internet.

For remote administration, use OpenClaw's authenticated remote-access guidance and a private overlay network. See [Deploy Kaki](/kaki/deployment).

## Inspect before installing

```bash
git clone https://github.com/premhiru/openclaw-kaki.git
cd openclaw-kaki
git rev-parse HEAD
./kaki/scripts/install.sh --dry-run
```

Expected final line:

```text
Kaki installer dry run passed.
```

The dry run resolves the repository root, validates the platform and Node runtime, and checks the launcher destination. It does not install dependencies or create the launcher.

## Install

```bash
./kaki/scripts/install.sh
```

The installer:

1. validates the source checkout and supported Node range;
2. activates the pinned pnpm through Corepack;
3. installs from the root lockfile with frozen dependency resolution;
4. builds the required OpenClaw and Kaki workspaces;
5. writes a managed launcher to `$HOME/.local/bin/kaki`.

It refuses to replace a file it does not own. This protects an unrelated command already named `kaki`.

If the launcher directory is not on `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Persist that line in the appropriate shell profile only after confirming the directory is correct.

## Use another launcher directory

The destination must be an absolute path:

```bash
./kaki/scripts/install.sh --bin-dir "$HOME/.local/kaki-bin"
export PATH="$HOME/.local/kaki-bin:$PATH"
```

If an unmanaged file already exists, inspect and move it yourself. Kaki will not delete or overwrite it.

## Verify the installation

```bash
command -v kaki
kaki --version
kaki --help
```

Then continue to [Onboard a household](/kaki/onboarding). Installation alone does not create household state or enable the plugin.

## State isolation

The launcher maps Kaki onto an isolated OpenClaw runtime:

| Variable                 | Launcher default       |
| ------------------------ | ---------------------- |
| `KAKI_HOME`              | `$HOME/.kaki`          |
| `OPENCLAW_STATE_DIR`     | `$KAKI_HOME`           |
| `OPENCLAW_CONFIG_PATH`   | `$KAKI_HOME/kaki.json` |
| `OPENCLAW_WORKSPACE_DIR` | `$KAKI_HOME/workspace` |

Set `KAKI_HOME` before invoking `kaki` to use another absolute state location:

```bash
export KAKI_HOME="/srv/kaki/household-primary"
kaki gateway status
```

Keep one state directory per household deployment. Do not point two running Gateways at the same state.

The Kaki launcher disables OpenClaw automatic update checks, usage reporting, and OpenTelemetry for that process. The retained `openclaw` launcher keeps upstream opt-in behavior.

## Update an installation

Record the current commit and back up state first. Then update the source checkout without rewriting local history:

```bash
git fetch --all --prune
git pull --ff-only
./kaki/scripts/install.sh
```

Restart the Gateway and run:

```bash
kaki gateway status
kaki status --deep --json
```

See [Operate Kaki](/kaki/operations) for the complete update and rollback procedure.

## Remove the launcher

There is no destructive uninstaller. To stop using a checkout:

1. stop the Gateway using the service method selected during onboarding;
2. preserve a protected copy of `KAKI_HOME` if recovery may be needed;
3. inspect the launcher path with `command -v kaki`;
4. remove only the managed launcher you verified;
5. remove the source checkout separately if desired.

Deleting the launcher does not delete household state. Deleting `KAKI_HOME` is permanent and is not a troubleshooting step.

## Installation failures

| Symptom                    | Next action                                                               |
| -------------------------- | ------------------------------------------------------------------------- |
| Unsupported Node version   | Install an exact supported range and rerun the dry run                    |
| Native Windows rejection   | Use Linux, macOS, or a separately evaluated supported host                |
| Unmanaged launcher refusal | Move the existing file or select a new absolute `--bin-dir`               |
| Frozen install failure     | Check the exact commit, network, Corepack, and lockfile integrity         |
| Build failure              | Preserve the first error and use [Troubleshooting](/kaki/troubleshooting) |

Never work around an installer safety check by replacing the managed-launcher marker or editing generated files. Fix the reported boundary instead.
