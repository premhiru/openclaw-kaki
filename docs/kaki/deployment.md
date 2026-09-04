---
summary: "Plan and run a single-host Kaki deployment, service lifecycle, network boundary, and recovery path."
read_when:
  - You are moving from evaluation to an always-on host
  - You are configuring a daemon or remote access
  - You need a deployment and recovery checklist
title: "Deploy Kaki"
---

The supported Kaki path is a source installation on a trusted Ubuntu/Linux or macOS host. Start with one household, one `KAKI_HOME`, and one Gateway. Add channels and external services only after the local authenticated path is healthy.

## Recommended topology

```text
trusted operator
      |
private LAN / overlay
      |
Kaki host
  +-- OpenClaw Gateway
  +-- Kaki plugin and Control UI
  +-- model/provider clients
  +-- managed browser (optional)
  +-- KAKI_HOME state
      |
OpenClaw channels / bounded providers / optional device
```

Keep the state, Gateway, and operator surface on one trusted host initially. A remote model or device should receive only the access and context it needs.

## Capacity planning

Kaki does not publish a universal hardware minimum. Capacity depends mostly on OpenClaw model choice, browser use, retained state, and whether models run locally.

Plan for:

- supported Node.js and enough memory for the OpenClaw build/Gateway;
- additional browser memory when automation is enabled;
- encrypted storage for state and backups;
- log rotation and free-space monitoring;
- stable time synchronization;
- outbound network access only to configured providers;
- reliable power/network for an always-on service.

Measure on the intended workload before calling it production-ready.

## Prepare the host

1. patch the OS and Git;
2. install an exact supported Node range and Corepack;
3. create a dedicated unprivileged account where practical;
4. choose the source checkout and protected state paths;
5. configure encrypted backup storage outside the checkout;
6. restrict inbound network access;
7. install from the exact reviewed commit.

See [Install Kaki](/kaki/installation).

## Install and onboard

```bash
git clone https://github.com/premhiru/openclaw-kaki.git
cd openclaw-kaki
./kaki/scripts/install.sh --dry-run
./kaki/scripts/install.sh
kaki onboard --classic --install-daemon \
  --kaki-profile "$HOME/.config/kaki/profile.json"
```

Onboarding delegates service installation to OpenClaw. Record which service manager and account it selected. Restart behavior, environment injection, and log access must be understood before relying on the daemon.

## Service environment

The service must receive the same `KAKI_HOME` and SecretRef environment used during validation. Interactive shell exports usually do not propagate to a daemon.

Verify the service manager's protected environment without printing values. Keep environment files outside the repository with restrictive permissions.

## Startup validation

After starting or restarting:

```bash
kaki gateway status
kaki status --deep --json
```

Then:

1. open `kaki dashboard` through the authenticated URL;
2. confirm the Kaki snapshot is expected;
3. test a non-owner rejection;
4. test one harmless local conversation;
5. verify one channel at a time;
6. verify providers only with bounded read-only probes.

Do not enable money, booking, identity, account-change, or external-message authority during initial validation.

## Network boundary

Prefer local-only binding. If remote administration is required:

- use OpenClaw's authenticated remote-access pattern;
- use a private overlay/VPN;
- configure proxy trust explicitly;
- restrict the operator origin and account;
- audit authentication failures;
- keep browser, ADB, model, and storage ports private.

The Kaki Control API is not a public webhook API. Do not expose `/api/kaki/action` for third-party automation.

## Channels and providers

Roll out in stages:

1. dashboard/WebChat local path;
2. Telegram owner controls;
3. one household conversation channel;
4. public/read-only data;
5. browser preparation flows;
6. only then consider approval-bound workflows.

Each stage needs a disable/revocation method and a current operator runbook.

## State and persistence

The launcher defaults to:

```text
~/.kaki/
  kaki.json
  workspace/
  ...OpenClaw and plugin state...
```

Treat the whole resolved `KAKI_HOME` as private application state. Do not mount one home into two active Gateways. Keep it off network shares that do not preserve required locking and permissions.

## Backups

For the conservative supported procedure:

1. stop the Gateway cleanly;
2. verify no Kaki/OpenClaw process is writing the state;
3. copy the entire resolved `KAKI_HOME` to encrypted, access-controlled storage;
4. preserve metadata and permissions;
5. record source commit, time, and checksum/manifest privately;
6. periodically restore into an isolated staging location and run read-only checks.

Do not copy live SQLite files while they may have WAL/journal writes. Do not commit state to Git.

## Updates

Use a reviewed commit and a maintenance window:

```bash
git fetch --all --prune
git pull --ff-only
./kaki/scripts/install.sh
```

Restart, then run the startup validation. Preserve the prior commit and state backup until the new version has completed channel and provider probes.

## Rollback

1. stop the Gateway;
2. preserve the failed state and diagnostics;
3. check out the recorded known-good commit;
4. rerun the managed installer;
5. restore state only when a migration/release note requires it;
6. restart with risky automation restricted;
7. reconcile approvals and external side effects before resuming.

Never use `git reset --hard` or delete `KAKI_HOME` as an operational rollback.

## Availability

Kaki's repository verifies clean install/onboarding on Ubuntu and macOS, but it does not provide an HA or multi-node household-state contract. Run one authoritative Gateway per state root.

For higher availability, first define externally:

- service restart policy;
- encrypted backup frequency;
- host monitoring;
- channel outage behavior;
- operator alert path;
- recovery-time and data-loss objectives.

Do not improvise active-active access to the same SQLite/plugin state.

## Deployment checklist

- [ ] exact reviewed commit recorded;
- [ ] supported OS and Node range;
- [ ] dedicated account and protected paths;
- [ ] service receives `KAKI_HOME` and SecretRefs;
- [ ] Gateway and internal ports private;
- [ ] authenticated dashboard verified;
- [ ] owner/non-owner channel checks pass;
- [ ] encrypted backup and staging restore tested;
- [ ] provider caps and revocation documented;
- [ ] limitations reviewed;
- [ ] rollback commit and procedure recorded.

For daily service procedures, continue to [Operations](/kaki/operations). For threats and incident handling, see [Security](/kaki/security).
