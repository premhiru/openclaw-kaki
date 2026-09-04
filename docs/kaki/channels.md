---
summary: "Connect and operate Kaki through the Control UI, Telegram, WhatsApp, and OpenClaw channels."
read_when:
  - You are choosing or configuring a Kaki channel
  - A channel is configured but not ready
  - You need the authentication and ownership rules
title: "Kaki channels"
---

Kaki uses OpenClaw's Gateway and channel integrations. The Kaki plugin adds an authenticated Control UI and owner-only Telegram commands; it does not replace channel login, delivery, allowlisting, or provider policy.

## Channel matrix

| Surface                 | Kaki support                                 | Authentication                                          | Primary use                                     |
| ----------------------- | -------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Control UI              | Packaged Kaki tab                            | Gateway authentication and `operator.write` for actions | Household overview and operator actions         |
| Telegram                | Kaki command set                             | Authorized sender plus household-owner check            | Remote operator controls and status projections |
| WhatsApp                | OpenClaw-owned account, Kaki relink shortcut | OpenClaw channel session and allowlists                 | Household conversation after live verification  |
| WebChat                 | OpenClaw-owned                               | Gateway/session policy                                  | Local evaluation and conversation               |
| Other OpenClaw channels | Available through extra-channel onboarding   | Channel-specific                                        | Optional; not Kaki-specific evidence            |

## Control UI

Start the Gateway and open the authenticated dashboard:

```bash
kaki gateway run
kaki dashboard
```

Kaki is mounted at `/plugins/kaki/control`. The snapshot endpoint is no-store and capped at 1 MB. Actions require Gateway authentication, the appropriate scope, JSON content, and the `X-Kaki-Intent: operator-action` header.

Do not copy the internal route onto a public reverse proxy. Use the URL and authentication opened by `kaki dashboard`.

The current UI displays more state than it can reliably edit. Verify owner state after any action, especially household/journey edits, phone commands, trace positioning, and approval resume behavior.

## Telegram

Kaki registers these owner-authenticated commands:

| Command                   | Scope            | Behavior                                    |
| ------------------------- | ---------------- | ------------------------------------------- |
| `/household`              | `operator.read`  | Lists up to 20 projected household members  |
| `/journey`                | `operator.read`  | Lists up to 20 projected journey items      |
| `/skills`                 | `operator.read`  | Lists maintained, learned, and phone skills |
| `/cron`                   | `operator.read`  | Lists schedules and next-run projections    |
| `/locale [code]`          | `operator.write` | Reads or changes the active locale          |
| `/phone screenshot`       | `operator.write` | Requests the experimental screenshot owner  |
| `/phone tap <target>`     | `operator.write` | Requests an experimental visible-target tap |
| `/relink-wa`              | `operator.admin` | Starts the trusted WhatsApp relink owner    |
| `/deny <id> <facts-hash>` | `operator.write` | Denies the exact pending approval facts     |
| `/pause`, `/resume`       | `operator.write` | Stores the projected pause flag             |
| `/cost`                   | `operator.read`  | Shows recorded cost projections             |

OpenClaw owns `/status` and `/approve`. Kaki intentionally does not register competing versions.

All Kaki commands require both an authorized sender and `senderIsOwner=true`. Test this boundary from a non-owner account before adding household data.

## Telegram verification

1. Send `/household` from the configured owner.
2. Confirm the response contains only the expected projection.
3. Send `/household` from a non-owner test account.
4. Confirm it receives the owner-only warning and no household data.
5. Run `/locale` and confirm currency/timezone projection.
6. Compare `/cron` with the Control UI snapshot.

Do not paste bot tokens or raw update payloads into an issue.

## WhatsApp setup

The default onboarding identifies account `assistant`. Actual linking remains an OpenClaw operation and requires the official QR/session flow. Use a dedicated assistant account where provider terms allow it, configure the narrowest household allowlist, and send a harmless test message before relying on delivery.

Kaki provides a launcher alias:

```bash
kaki wa relink
kaki wa relink --account assistant --verbose
```

Equivalent OpenClaw ownership remains visible under channel login. Display QR codes only in a trusted local terminal or authenticated UI. A QR code is a credential—never record or attach it.

If WhatsApp returns a ban, logout, or rate limit, stop reconnect loops and outbound work. Do not rotate numbers or bypass pacing. Follow provider terms and [Troubleshooting](/kaki/troubleshooting).

## Extra channels

To make OpenClaw's complete channel picker available during onboarding:

```bash
kaki onboard --classic --install-daemon --enable-extra-channels \
  --kaki-profile "$HOME/.config/kaki/profile.json"
```

These channels use upstream OpenClaw configuration and documentation. Their presence in the picker does not make them a Kaki-tested household surface.

## Channel status

```bash
kaki gateway status
kaki status --deep --json
```

Interpret status in layers:

- **configured:** an account/reference exists;
- **owner available:** the runtime service resolved;
- **authenticated:** the provider accepted the current session;
- **delivery verified:** a bounded message completed and was observed;
- **operational:** the workflow has a current runbook, limits, and recovery path.

Do not collapse these into a single green label.

## Group and sender safety

- allowlist household senders and groups explicitly;
- reject unknown senders before household context or model work;
- keep vendor conversations separate from household threads;
- treat quoted messages, links, files, and provider metadata as untrusted input;
- do not disclose one member's private information to another without confirmed scope;
- keep administrative commands owner-only.

Kaki's repository tests cover command authorization and projections. Your channel allowlist and live provider session still require operator verification.

## Delivery troubleshooting

| Symptom                                 | Check                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Command says runtime owners unavailable | Finish onboarding, restart the Gateway, check plugin config               |
| Owner command is rejected               | Verify authorized sender mapping and configured operator                  |
| Configured channel is pending           | Complete the channel owner's authentication flow                          |
| Message sends but no reply arrives      | Inspect Gateway/channel status and delivery logs without exposing content |
| Repeated `429`                          | Respect provider retry time; stop looping                                 |
| WhatsApp session is corrupt             | Relink through the trusted local flow; revoke exposed linked devices      |

For channel-independent testing, onboard with `--skip-channels` and prove the local Gateway and authenticated Kaki tab first.
