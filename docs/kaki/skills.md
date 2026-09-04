---
summary: "Understand Kaki's regional skill catalogue, execution model, risk metadata, and verification."
read_when:
  - You want to know what Kaki skills are available
  - You are evaluating whether a skill is safe to run
  - You are adding or modifying a skill
title: "Kaki skills"
---

Kaki ships declarative playbooks for household tasks in Singapore and Southeast Asia. A skill describes when it applies, required facts, execution surfaces, approval boundaries, recovery, and fixtures. It is not an account credential or proof that an external service is currently available.

## Catalogue coverage

| Catalogue          | Count | Scope                                                                               |
| ------------------ | ----: | ----------------------------------------------------------------------------------- |
| Singapore (`sg`)   |    46 | Household, transport, weather, government, commerce, travel, and family workflows   |
| Regional (`sea`)   |     8 | Cross-border QR, remittance, halal, prayer, travel, holidays, and language bridging |
| Malaysia (`my`)    |     5 | DuitNow, Touch 'n Go, JPJ, LHDN, and MyEG                                           |
| Indonesia (`id`)   |     5 | QRIS, Gojek, Tokopedia, PLN, and BPJS                                               |
| Thailand (`th`)    |     5 | PromptPay, LINE MAN, transit, revenue, and weather                                  |
| Vietnam (`vn`)     |     5 | VietQR, Zalo, MoMo, EVN, and VNeID handoff                                          |
| Philippines (`ph`) |     5 | QR Ph, GCash, eGovPH, Meralco, and PAGASA                                           |
| Phone playbooks    |    11 | Bounded mobile-app task descriptions                                                |

The generated catalogue contains 79 maintained regional skills. Phone playbooks are a separate set and are not dispatched by the `kaki_skill` tool.

## Skill anatomy

Every maintained skill has a `SKILL.md` with frontmatter and a task contract. A useful skill specifies:

- stable ID and human title;
- locales and trigger conditions;
- required confirmed inputs;
- data, browser, phone, channel, or approval steps;
- risk category and irreversible boundary;
- provider/source expectations;
- failure and human-handoff behavior;
- deterministic fixture cases.

Onboarding seeds skills into `$KAKI_HOME/workspace/skills`. Existing destination files are preserved, so a household customization is not silently overwritten by an update.

## How dispatch works

The optional `kaki_skill` plugin tool accepts a maintained catalogue ID and a session key. It loads the checked-in playbook, creates an OpenClaw subagent turn, and supplies the playbook as the task instructions. The host still owns model execution, tools, authentication, and session policy.

A skill name is not a callable provider integration by itself. The receiving agent must have the required owner/tool, credentials, network access, and policy context.

## Risk categories

Kaki policy recognizes these important categories:

| Category              | Default policy behavior                                 |
| --------------------- | ------------------------------------------------------- |
| `none`, `data.read`   | Automatic after normal authorization                    |
| `message.household`   | Automatic for the allowlisted household path            |
| `message.external`    | Ask on first contact unless allowlisted/thread-approved |
| `booking`             | Ask                                                     |
| `data.share`          | Ask                                                     |
| `account.change`      | Ask                                                     |
| `gov.singpass`        | Always ask for human handoff                            |
| Money-related actions | Validate currency, amount, payee, hard limits, and caps |

Skill metadata cannot override the policy engine. `requiresApproval: false` is never authority to bypass a deterministic decision.

## Read-only versus commit steps

A well-formed workflow separates:

1. **query:** obtain bounded facts;
2. **normalize:** convert provider data into typed facts;
3. **verify:** check source, freshness, identity, and amount;
4. **prepare:** fill a form or construct an action without committing;
5. **approve:** bind the material facts for human review;
6. **commit:** perform the irreversible step once;
7. **reconcile:** verify the outcome and retain safe evidence.

For evaluation, stop after `verify` or `prepare`. Do not test a payment, booking, submission, external message, or account change merely to see whether the skill works.

## Regional examples

### Public-data and read-only

- `sg.bus-mrt-now`
- `sg.weather-commute`
- `sg.haze-watch`
- `sg.hawker-finder`
- `sea.halal-finder`
- `sea.prayer-times`
- `th.bts-mrt`
- `ph.pagasa-weather`

These are structurally read-only, but provider availability and freshness still need a live probe.

### Approval-bound

- payments and QR rails;
- bookings and purchases;
- government or identity handoffs;
- household-data sharing;
- first contact with vendors;
- account changes.

Review the exact destination, amount, currency, identity, schedule, and data recipients before approval.

## Phone playbooks

The 11 phone playbooks include Grab ride/food, Foodpanda, SimplyGo, Parents Gateway, HealthHub, bank read-only, Touch 'n Go, GCash, MoMo, and a generic app task.

They document intended mobile behavior, but current physical Android integration is incomplete because the packaged OpenClaw handler and Kaki companion use different command contracts. Do not treat these playbooks as supported end-to-end automation.

## Check installed skills

From the Telegram owner:

```text
/skills
```

Or inspect the seeded workspace without printing private modifications:

```bash
find "${KAKI_HOME:-$HOME/.kaki}/workspace/skills" -mindepth 1 -maxdepth 1 -type d -print
```

The Telegram projection is limited to 20 rows and may end with an “and more” line.

## Evaluate a skill safely

1. read the installed `SKILL.md`;
2. identify every external provider and execution surface;
3. classify the last reversible step;
4. confirm the policy category and required material facts;
5. run the deterministic fixture/test path;
6. run at most one bounded live read-only probe;
7. test provider-unavailable and denial behavior;
8. record the exact commit and sanitized evidence.

<Warning>
Never add real credentials, private household data, live QR codes, or portal screenshots to a fixture. Never use a production payment or identity account to validate a new skill.
</Warning>

## Add or change a maintained skill

Use a stable region-prefixed slug and follow the adjacent playbook contract. Then regenerate/check the catalogue and run focused tests:

```bash
pnpm --filter @kaki/skills generate:check
pnpm --filter @kaki/skills typecheck
pnpm --filter @kaki/skills test
```

The test suite checks catalogue drift, duplicate/meaningless bodies, fixtures, approval fencing, and dispatcher behavior. Run the complete [Kaki test strategy](/kaki/testing) before release.

## Learned skills

The workspace contains a location for learned/draft material, but a learned trajectory must not automatically broaden capability, add permissions, or weaken approvals. Sanitize private data, replay against fixtures, review risk metadata, and require human review before promotion.

For the exact decision lifecycle, continue to [Approvals and safety](/kaki/approvals). For live-service boundaries, see [Integrations](/kaki/integrations).
