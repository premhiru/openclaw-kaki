---
summary: "Operate, monitor, back up, update, recover, and respond to incidents in a Kaki deployment."
read_when:
  - You operate an installed Kaki Gateway
  - You are updating, backing up, or recovering Kaki
  - A channel, provider, or approval path is degraded
title: "Operate Kaki"
---

Kaki keeps its state separate from the default OpenClaw runtime. Operate one authoritative Gateway per `KAKI_HOME`, keep a known-good commit and protected backup, and verify every external surface independently.

## State locations

Unless `KAKI_HOME` is set, the launcher uses:

| Data                  | Path                            |
| --------------------- | ------------------------------- |
| State root            | `~/.kaki`                       |
| Gateway config        | `~/.kaki/kaki.json`             |
| Workspace             | `~/.kaki/workspace`             |
| Plugin/OpenClaw state | beneath the resolved state root |

Check the effective configuration without printing private contents:

```bash
kaki config path
printf '%s\n' "${KAKI_HOME:-$HOME/.kaki}"
```

Keep state readable only by the service account.

## Daily health check

```bash
kaki gateway status
kaki status --deep --json
```

Then verify:

1. the authenticated dashboard opens;
2. the Kaki snapshot loads without `503`;
3. Telegram owner commands work and a non-owner is rejected;
4. enabled schedules show plausible next runs;
5. each required provider has a recent bounded probe;
6. no stale approval or delivery needs reconciliation;
7. disk, memory, time sync, and backup status are healthy.

A configured surface is not necessarily authenticated or operational. Track those states separately.

## Start and stop

For an interactive process:

```bash
kaki gateway run
```

For an installed daemon, use the service manager selected during OpenClaw onboarding. Record the service name, account, environment source, restart policy, and log location in the deployment runbook.

Stop the service before a conservative state backup or restore. Confirm no process is writing `KAKI_HOME`.

## Dashboard

```bash
kaki dashboard
```

Use only the authenticated Gateway URL. The Kaki page is `/plugins/kaki/control`. Refresh owner state after actions; do not rely on a success toast for an external side effect.

## Maintenance window

Before changing source, configuration, credentials, or state:

1. announce the window to household operators;
2. stop new risky work at an enforceable boundary;
3. record the exact commit and status;
4. reconcile pending approvals and external writes;
5. create and verify a protected backup;
6. make one class of change;
7. restart and run read-only checks first;
8. restore channels/providers in stages.

The projected `/pause` flag is not sufficient for incident or maintenance isolation.

## Back up state

The conservative repository-documented procedure is an offline filesystem backup:

1. stop the Gateway cleanly;
2. confirm the resolved `KAKI_HOME` and that no writer remains;
3. copy the complete state root to encrypted, access-controlled storage outside the checkout;
4. preserve permissions and metadata;
5. record source commit, timestamp, and an integrity manifest/checksum privately;
6. restart the Gateway;
7. periodically restore into an isolated staging directory and run read-only validation.

Do not copy live SQLite database/WAL/journal files while writes may be active. Do not use Git for private state or channel sessions.

A backup may include household memory, approvals, configuration, sessions, and credential material owned by OpenClaw providers. Apply the same security boundary as the live host.

## Restore rehearsal

Never overwrite live state as the first restore test.

1. provision an empty protected staging path;
2. restore the backup into it;
3. point a stopped, isolated validation process at that path;
4. verify structure and permissions without connecting live channels;
5. run config/database checks available to the exact release;
6. inspect sanitized status;
7. discard or securely retain the staging copy according to policy.

For real recovery, preserve current failed state, stop all writers, activate the restored state atomically where possible, then reconcile channel sessions and irreversible actions before resuming.

## Update

From the source checkout:

```bash
git rev-parse HEAD
git fetch --all --prune
git pull --ff-only
./kaki/scripts/install.sh
```

Restart and verify:

```bash
kaki gateway status
kaki status --deep --json
```

Also open the dashboard, test owner/non-owner access, inspect schedules, and perform only bounded read-only provider checks. Keep the prior commit and backup until the new release is accepted.

## Roll back

1. stop the Gateway;
2. preserve the failed state and sanitized diagnostics;
3. check out the previously recorded known-good commit without destroying unrelated work;
4. run `./kaki/scripts/install.sh`;
5. restore state only when release/migration evidence requires it;
6. restart with risky integrations disabled or restricted;
7. reconcile pending approvals, messages, bookings, and provider writes;
8. re-enable one surface at a time.

Deleting `KAKI_HOME` is not rollback. Never replay an irreversible action merely because local state is uncertain.

## Change household configuration

Update the protected profile outside Git, then rerun:

```bash
kaki onboard --classic --install-daemon \
  --kaki-profile /protected/path/profile.json
```

Restart the Gateway and verify the new projection. Workspace seeding preserves existing files, so repository persona/skill changes may require manual review when a household has customized them.

## Rotate a secret

1. restrict the affected integration;
2. rotate/revoke at the authoritative provider;
3. update the selected SecretRef source;
4. restart or re-onboard only as required by that owner;
5. run a bounded probe;
6. verify the old credential/session no longer works;
7. inspect logs/backups for exposure scope.

Never print the old or new value during verification.

## WhatsApp recovery

```bash
kaki wa relink
kaki wa relink --account assistant --verbose
```

Use the official trusted local QR flow. For logout, ban, or `429`, stop outbound work and reconnect loops first. Respect provider retry timing and terms; do not rotate numbers or parallelize senders to evade controls.

## Approval reconciliation

When an approval is stale or conflicting:

1. refresh the Kaki snapshot;
2. compare current ID and facts hash;
3. determine whether the external action already happened;
4. deny surprising/missing facts;
5. start a new request only from the last safe reversible step.

Never edit ledger records to force a pending approval through.

## Monitor operations

`/cron` lists projected schedules. Confirm the collector, data source, observation time, session audience, dedupe behavior, and notification sink separately. Dedupe may be in-memory and quiet hours are not universally enforced.

See [Monitors](/kaki/monitors).

## Incident response

### Immediate containment

1. stop new risky work at the Gateway, channel, credential, or provider boundary;
2. record time, commit, affected task/approval IDs, and redacted error;
3. preserve approval, delivery, and audit state;
4. revoke credentials/sessions if exposure is possible;
5. determine whether an external side effect completed;
6. keep raw secrets, OTPs, QR codes, cookies, and identity screenshots out of evidence.

### Recovery order

Restore in increasing risk:

1. local Gateway and authenticated dashboard;
2. read-only household projection;
3. operator/non-owner authorization;
4. channels;
5. public/read-only data;
6. browser/phone preparation;
7. approvals;
8. money, booking, identity, disclosure, and external messages last.

### Escalation record

Include exact source commit, OS/Node version, service state, sanitized deep status, timeline, provider status, approval/delivery reconciliation, containment, and next safe action.

## Routine schedule

| Frequency      | Tasks                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| Daily          | Gateway/deep status, disk, failed schedules, pending approvals            |
| Weekly         | Provider read-only probes, logs/alerts, backup completion                 |
| Monthly        | Restore rehearsal, credential/account review, dependency/security updates |
| Before release | Full Kaki verification, clean install evidence, limitations review        |
| After incident | Rotation, reconciliation, regression test, runbook update                 |

For symptom-first diagnosis, use [Troubleshooting](/kaki/troubleshooting). For host hardening and exposure response, see [Security](/kaki/security).
