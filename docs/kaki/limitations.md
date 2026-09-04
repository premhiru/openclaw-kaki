---
summary: "Understand Kaki's current capability boundaries and release-evidence rules."
read_when:
  - You are deciding whether Kaki is ready for a live workflow
  - You are interpreting a green Kaki test or acceptance report
title: "Kaki known limitations"
---

Kaki has broad deterministic coverage, but repository evidence and live-service evidence answer different questions. Use this page before giving Kaki external accounts, phone access, or financial authority.

## Evidence levels

| Level               | Proves                                                                                                    | Does not prove                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Unit/fixture test   | Parsing, policy, projections, failure handling, and recorded contract behavior                            | A third-party API, account, website, or physical device works now       |
| Clean-install CI    | A fresh supported runner can install, build, onboard with a fixture profile, and pass the selected checks | Your credentials, network, daemon host, or channel allowlist is correct |
| Operator live probe | One bounded call worked for the exact account and environment                                             | Long-term availability or unrestricted workflow safety                  |
| Release evidence    | The named build completed its required non-fixture acceptance checks                                      | Suitability for credentials or authority outside the documented scope   |

`pnpm --dir kaki acceptance` may report pending live checks and still be useful. `pnpm --dir kaki acceptance:release` is the strict gate and must not pass without non-fixture evidence for the exact build.

## Current boundaries

### External services

The repository does not claim live readiness for WhatsApp, Gmail, Grab, Singpass, banking, government portals, LTA, OneMap, or a model provider. Account authorization, terms, rate limits, bot detection, provider drift, and outages need bounded operator probes.

### Pause is not a kill switch

`/pause` stores a boolean through the Kaki owner. Current skill and monitor execution paths do not universally enforce it. Stop or restrict work at the channel, Gateway service, credential, or provider boundary during an incident.

### Cost and budget are projections

`/cost` and the onboarding budget expose recorded values. They are not wired to every subagent/model execution path and are not complete billing records or hard spending limits. Use provider-side caps and billing alerts.

### Control UI is not a complete operator console

The authenticated Kaki tab and HTTP handlers exist, but some packaged interactions are incomplete: household/journey edit payloads, visible-target phone taps, relaunch behavior, trace positioning, and approval resume behavior. Verify the resulting owner state instead of trusting a button response alone.

### Physical Android control is incomplete

The plugin expects OpenClaw node commands `mobile.ui.observe` and `mobile.ui.act`. The current Android Play handler reports unavailable, while the separate Kaki companion registers `kaki.phone.task.execute`. These contracts do not yet form a supported end-to-end phone path.

### Quiet hours and locale coverage

Quiet-hours settings are not currently enforced. Monitors use `Asia/Singapore`. Myanmar (`mm`) and Cambodia (`kh`) locale packs are conservative stubs; validate language, currency, and regulatory wording with a local operator.

### Config references are not all runtime owners

Onboarding validates the required reference IDs, but several are not yet used to resolve live runtime owners. A valid config is not proof of a healthy integration; use `kaki status --deep` and a bounded live probe.

## Safe evaluation rules

- Use dedicated assistant-owned accounts with the lowest useful permissions.
- Keep payment caps and device wallet balances near zero.
- Never provide bank credentials, Singpass credentials, reusable OTPs, or production medical access.
- Test denial, stale approval, non-owner access, and provider-unavailable paths—not only success.
- Record the source commit and sanitized evidence for every live probe.
- Remove or rotate evaluation credentials when testing ends.

For setup, use the [Quickstart](/kaki/quickstart). For a failed boundary, use [Troubleshooting](/kaki/troubleshooting).
