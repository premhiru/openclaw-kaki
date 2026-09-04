---
summary: "Configure, verify, and safely operate Kaki's proactive monitor templates."
read_when:
  - You want proactive household notifications
  - You are enabling or debugging a monitor
  - You need to understand deduplication and quiet-hour limits
title: "Kaki monitors"
---

Kaki includes monitor contracts for time-sensitive household facts. A monitor evaluates a compact fact object and may create a notification/announcement turn. The template does not automatically provision a provider client or guarantee fresh data.

## Available monitor kinds

The Singapore data package implements evaluators for:

- rain before commute;
- train disruption;
- haze;
- hawker closure;
- CPF and SRS deadlines;
- IRAS filing window;
- dengue near home;
- ERP rate changes;
- vehicle, road-tax, season-parking, and insurance expiry;
- COE results;
- housing, BTO, and resale matches.

The onboarded owner projection currently exposes ten configured schedule templates. The evaluator type supports additional kinds that may require separate registration and data collection.

## How a monitor works

```text
schedule -> collect compact facts -> evaluate -> deduplicate -> notify
```

1. A scheduler invokes a registered monitor no more frequently than its declared interval.
2. A collector supplies compact typed facts.
3. A deterministic evaluator decides whether the threshold is met.
4. A dedupe key suppresses the same result within the active store.
5. The notification sink announces the result to the configured session.

Collection, provider credentials, and model choice remain injected by the host. The template by itself does not fetch live data.

## Inspect schedules

From the Telegram owner:

```text
/cron
```

The response lists projected schedules and next-run times, up to the command output limit. The Control UI snapshot also exposes monitor state.

Run:

```bash
kaki status --deep --json
```

This helps distinguish an enabled schedule from an unavailable runtime owner, but it does not prove the collector returned fresh provider data.

## Enable or disable

Use the authenticated Control UI, or the internal action contract:

```json
{
  "type": "monitor.set",
  "id": "monitor-id",
  "enabled": true
}
```

After a change, refresh the snapshot and confirm the owner reports the expected value.

<Warning>
Disabling a projected monitor is not an incident-wide kill switch. Stop the scheduler/Gateway or revoke the provider boundary when you need enforceable suspension.
</Warning>

## Threshold behavior

Examples from the deterministic evaluators:

| Kind                | Notification condition                                    |
| ------------------- | --------------------------------------------------------- |
| Rain before commute | Probability at least 60% and commute within 0–120 minutes |
| Haze                | PSI at least 100                                          |
| CPF/SRS deadline    | 0–14 days remaining                                       |
| IRAS window         | Open and within the configured notice period              |
| Dengue near home    | Cases above zero within the configured radius             |
| ERP change          | Old and new rates differ and the new rate is finite       |
| Expiry monitors     | Within the configured notice period                       |
| Housing match       | New match count above zero                                |

These rules evaluate the provided facts; they do not verify that the facts came from the correct provider or observation time.

## Dedupe and restart behavior

The package includes an in-memory dedupe store. Its keys do not survive a process restart unless the runtime owner provides durable storage. Design notifications so a safe duplicate is understandable and does not trigger an irreversible action.

A notification must never itself commit a payment, booking, disclosure, or account change.

## Session routing

The onboarding profile's `monitorSessionKey` identifies the session that receives scheduled announcement turns. Confirm:

- the session exists;
- its agent has only the required data/tool access;
- the audience is appropriate for the facts;
- the session does not leak one member's private information to the household;
- failure notifications reach the operator.

## Quiet hours and timezone

Current schedules use `Asia/Singapore`. Quiet-hours configuration exists in policy-related contracts, but enforcement is incomplete across monitor execution. Do not rely on quiet hours for safety or compliance.

If notification timing matters, enforce it in the scheduler or channel owner and test across restarts and daylight/calendar boundaries.

## Verify a monitor

Use a deterministic fixture before a live provider:

1. provide facts below the threshold and confirm no notification;
2. provide facts at the threshold and confirm one notification;
3. replay the same dedupe key and confirm suppression;
4. change the material snapshot/dedupe key and confirm a new notification;
5. simulate collector failure and confirm it does not invent a result;
6. verify disabled state;
7. verify the receiving session and audience.

Then run one bounded live read-only collector probe and record source plus observation time.

## Design a collector

A safe collector should:

- call an official or documented source;
- use a deadline and bounded retry policy;
- return only facts needed by the evaluator;
- include observation/source metadata outside private message content;
- reject malformed units and impossible values;
- label stale data;
- avoid model interpretation when deterministic parsing works;
- contain no credential or household narrative in logs.

## Notification quality

Every notification should tell the user:

- what changed;
- source/observation time when relevant;
- why it matters;
- the safe next action;
- whether the data may be stale;
- how to disable or investigate the monitor.

Avoid repeated urgency, opaque IDs, or instructions that imply a provider transaction already occurred.

## Common failures

| Symptom                                  | Likely cause                                          |
| ---------------------------------------- | ----------------------------------------------------- |
| Schedule appears but never notifies      | Collector or notification owner is not wired/healthy  |
| Notification is duplicated after restart | In-memory dedupe state was lost                       |
| Notification arrives at the wrong time   | Fixed Singapore timezone or unenforced quiet hours    |
| Provider data is stale                   | Collector/cache contract, not evaluator logic         |
| `/cron` is empty                         | Runtime owners unavailable or no configured templates |

For general recovery, see [Troubleshooting](/kaki/troubleshooting). For provider evidence, see [Integrations](/kaki/integrations).
