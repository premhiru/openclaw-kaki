---
summary: "Use Kaki from the dashboard and authenticated Telegram controls."
read_when:

- Your Kaki Gateway is onboarded
- You need the operator commands or approval behavior
  title: "Use Kaki"

---

After onboarding, run the Gateway and open the dashboard:

```bash
kaki gateway run
```

```bash
kaki dashboard
```

The Kaki tab is at `/plugins/kaki/control` inside the authenticated OpenClaw Control UI. It reads a no-store household snapshot and sends operator actions through the Gateway authentication boundary.

## Telegram controls

Kaki commands require an authenticated sender who is the configured household owner.

| Command                                  | Result                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `/household`                             | List household members and language settings.                                       |
| `/journey`                               | List the household journey timeline.                                                |
| `/skills`                                | List maintained, learned, and phone skills.                                         |
| `/cron`                                  | List Kaki schedules and their next run.                                             |
| `/locale`                                | Show the active locale.                                                             |
| `/locale sg\|my\|id\|th\|vn\|ph\|mm\|kh` | Change the active locale.                                                           |
| `/phone screenshot`                      | Request a bounded screenshot action from the configured phone owner.                |
| `/phone tap <visible-target>`            | Request a tap by visible target text. Physical-phone support is incomplete.         |
| `/relink-wa`                             | Start the trusted local WhatsApp relink flow.                                       |
| `/deny <approval-id> <facts-hash>`       | Deny the exact pending approval facts.                                              |
| `/pause` / `/resume`                     | Store the requested automation state. Enforcement is not complete across all paths. |
| `/cost`                                  | Display the recorded cost projection. It is not complete billing data.              |

OpenClaw, not the Kaki plugin, owns `/status` and `/approve`. Kaki does not register a separate `/approve` command; follow the approval surface supplied by the host and verify that the approval ID and facts hash still match.

You can also begin WhatsApp relinking from the CLI:

```bash
kaki wa relink
kaki wa relink --account assistant --verbose
```

## Skills and approvals

Kaki seeds 79 maintained regional skills and 11 phone playbooks. The optional `kaki_skill` tool dispatches maintained catalogue entries through an OpenClaw subagent and requires a session key. Phone playbooks are not executable through that tool.

The implemented policy asks before Singpass/account changes, bookings, data sharing, first contact with an external party, unknown-payee payments, non-SGD payments, and payments with missing facts. A known-payee SGD payment below the configured cap may be automatic.

When a risky skill needs approval, it stops before the irreversible step and creates a durable record bound to the exact facts hash. Grants are operator-only, single-use, compare-and-swap protected, and expire after two hours by default.

<Warning>
Review the destination, amount, currency, identity, and facts hash. Reject an approval if anything changed. Do not interpret a UI success toast alone as proof that a risky action resumed or completed.
</Warning>

## Monitors

Kaki includes ten monitor templates. A schedule creates an announcement turn in the configured session; the template does not independently query a provider. Confirm that the receiving agent has the needed data access and that its result is useful before relying on a monitor.

Quiet-hours configuration exists, but enforcement is incomplete. All current monitor schedules use `Asia/Singapore`.

## Verify an operator session

1. Run `/household` from the configured Telegram owner and confirm the projected data is expected.
2. Send the same command from a non-owner test account. It must receive the owner-only rejection and no household data.
3. Open the authenticated Kaki tab and refresh the snapshot.
4. Check `kaki status --deep` after any channel or model change.

If runtime owners are unavailable, finish onboarding and restart the Gateway. See [Troubleshooting](/kaki/troubleshooting).
