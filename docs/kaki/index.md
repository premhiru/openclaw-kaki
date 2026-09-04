---
summary: "Install, onboard, and operate Kaki, a self-hosted household agent for Southeast Asia."
read_when:

- You are evaluating or starting Kaki
- You need to know what Kaki can safely do today
  title: "Kaki"

---

Kaki is a self-hosted household agent built on OpenClaw. It adds a household profile, regional skill catalogue, operator controls, approval records, and Southeast Asian locale packs to the OpenClaw Gateway.

Start with a source checkout on Ubuntu/Linux or macOS. A first local Gateway usually takes 15–30 minutes, plus any model or channel authorization.

<Card title="Get a verified Gateway" href="/kaki/quickstart" icon="rocket">
  Install Kaki, onboard a household, start the Gateway, and verify the result.
</Card>

## Choose your path

<Columns cols={2}>
  <Card title="First installation" href="/kaki/quickstart" icon="download">
    The shortest supported path from a source checkout to a healthy Gateway.
  </Card>
  <Card title="Prepare a household" href="/kaki/onboarding" icon="users">
    Build the private profile and SecretRefs that onboarding validates.
  </Card>
  <Card title="Use Kaki" href="/kaki/using-kaki" icon="message-circle">
    Open the dashboard and use the authenticated Telegram controls.
  </Card>
  <Card title="Operate Kaki" href="/kaki/operations" icon="activity">
    Check health, back up state, update, roll back, and gather diagnostics.
  </Card>
</Columns>

## The mental model

Kaki has four boundaries:

1. **The launcher** keeps Kaki state in `KAKI_HOME` (default `~/.kaki`) and uses `~/.kaki/kaki.json` as the OpenClaw config.
2. **Onboarding** validates a private household profile, seeds `SOUL.md` and the maintained skills without overwriting existing files, and writes only non-secret references to plugin config.
3. **The Gateway** owns authentication, model access, channels, sessions, and the browser-facing Control UI.
4. **The Kaki plugin** exposes household projections, owner-only Telegram commands, skill dispatch, approval records, and the `/plugins/kaki/control` tab.

A fixture-backed check proves a contract in the repository. It does not prove that a third-party account, physical phone, or live provider works for your household.

## Capability status

| Surface                                             | Status                         | What that means                                                                                                                          |
| --------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Source installer and managed launcher               | Implemented and CI-tested      | Linux/macOS install, frozen dependencies, build, dry run, and unmanaged-launcher refusal are covered.                                    |
| Profile validation and workspace seeding            | Implemented and CI-tested      | Required fields and SecretRefs are validated; maintained files are added without replacing household edits.                              |
| Kaki Control UI and HTTP handlers                   | Implemented with limitations   | Authenticated routes and action schemas are tested. Some editing and approval-resume interactions are not complete.                      |
| Telegram household controls                         | Implemented and owner-gated    | Kaki registers the commands in [Use Kaki](/kaki/using-kaki). `/status` and `/approve` remain OpenClaw-owned.                             |
| Skills and approval ledger                          | Implemented and fixture-tested | Risky skill plans can stop before commit and create single-use, facts-bound approvals. Live vendor completion still needs evidence.      |
| WhatsApp, Telegram, model, LTA, and OneMap accounts | Operator verification required | Kaki cannot prove credentials, provider terms, allowlists, or live availability from repository tests.                                   |
| Physical Android control                            | Experimental/incomplete        | The currently packaged Android handler and Kaki companion use different node command contracts. Do not rely on end-to-end phone control. |
| Pause, cost budget, and quiet hours                 | Partial                        | These values can be displayed or stored, but enforcement is not complete across skill and monitor execution.                             |

<Warning>
Do not give Kaki bank credentials, Singpass credentials, reusable OTPs, or meaningful payment authority. Use dedicated accounts and low caps while evaluating it.
</Warning>

## Documentation map

- [Quickstart](/kaki/quickstart): install and verify
- [Onboarding](/kaki/onboarding): profile fields, secrets, and channel choices
- [Use Kaki](/kaki/using-kaki): dashboard, Telegram commands, skills, and approvals
- [Operations](/kaki/operations): health, backups, updates, and rollback
- [Troubleshooting](/kaki/troubleshooting): symptom-first recovery
- [Reference](/kaki/reference): CLI, configuration, HTTP routes, and limits
- [Known limitations](/kaki/limitations): exact boundaries and release-evidence rules
