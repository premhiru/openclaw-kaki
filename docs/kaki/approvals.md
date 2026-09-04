---
summary: "Review Kaki policy decisions, approval cards, facts hashes, expiry, and safe operator behavior."
read_when:
  - Kaki asks for approval
  - You are configuring payment or action limits
  - An approval is stale, denied, expired, or duplicated
title: "Approvals and safety"
---

Kaki treats approval as a separate execution surface. A skill prepares an action, policy evaluates its risk, and the approval service records the material facts before any irreversible step. The operator approves or denies that exact record—not a vague intent.

## Policy outcomes

The policy engine returns one of three actions:

- `auto`: the declared facts meet an automatic rule;
- `ask`: create an approval/handoff before commit;
- `deny`: do not proceed.

Every decision includes a rule ID, reason code, evaluation time, and SHA-256 facts hash.

## Default categories

| Situation | Default outcome |
| --- | --- |
| Read-only operation | Automatic |
| Allowlisted household message | Automatic |
| First external contact | Ask |
| Previously approved/allowlisted external thread | Automatic |
| Booking | Ask |
| Sharing household data | Ask |
| Account change | Ask |
| Singpass/government identity step | Always ask and hand off |
| Invalid or missing money facts | Deny |
| Money above a configured hard limit | Deny |
| Wallet action above its cap | Deny |
| Known-payee SGD amount below the automatic cap | May be automatic |
| Other payment | Ask |

The public onboarding profile records an automatic cap and currency. Start at zero while evaluating. Provider-side limits remain necessary because Kaki's cost/budget projection is not a universal hard limit.

## Material facts

Material facts are the values that would change the operator's decision. Depending on the action, they include:

- payee, merchant, or recipient;
- amount, currency, fees, and payment rail;
- item, quantity, date, time, and cancellation terms;
- account, identity, or household member;
- external message recipient and final text;
- data fields and recipients being disclosed;
- portal, provider, or device surface.

Kaki canonicalizes these facts and hashes the canonical JSON. If a material value changes, the hash changes and the previous decision must not authorize the new action.

## Approval lifecycle

```text
pending -> approved -> grant issued -> grant consumed
    |          |
    |          +-> expires before use
    +-> denied
    +-> expired
```

Implemented protections include:

- unique approval/card IDs;
- household-scoped pending queries;
- operator-only decisions;
- exact 64-character lowercase hexadecimal facts hash;
- atomic compare-and-swap status changes;
- two-hour default expiry;
- single-use grants;
- audit events for the decision lifecycle.

A duplicate or concurrent decision is harmless: only the first matching transition succeeds.

## Review an approval

Before deciding:

1. identify the requested outcome in plain language;
2. compare recipient, amount, currency, schedule, and data recipients with the original request;
3. confirm the account and execution surface;
4. inspect warnings, fees, and cancellation terms;
5. verify the approval ID and facts hash are current;
6. deny if anything is missing, surprising, or stale.

<Warning>
Never approve a prompt that asks you to reveal an OTP, password, bank credential, Singpass credential, recovery code, or reusable token. Complete human-only authentication directly in the authoritative app or portal.
</Warning>

## Decide through Telegram

Kaki implements denial:

```text
/deny <approval-id> <facts-hash>
```

OpenClaw owns `/approve`; use the host-provided approval surface and verify the same ID and facts hash. Kaki intentionally does not register its own competing `/approve` command.

If Telegram reports that the approval changed, refresh the pending list/snapshot. Do not retry with the old hash.

## Decide through the Control API

```http
POST /api/kaki/action
Content-Type: application/json
X-Kaki-Intent: operator-action
```

```json
{
  "type": "approval.decide",
  "id": "approval-id",
  "decision": "denied",
  "factsHash": "64-lowercase-hex-characters"
}
```

The action parser requires exactly those keys. `decision` is `approved` or `denied`. A stale or concurrent record returns HTTP `409`; refresh the snapshot before any further decision.

Use the packaged authenticated UI instead of calling this internal route directly unless you are integrating the operator surface.

## After approval

Approval is permission for one exact commit attempt; it is not evidence of completion. Confirm the authoritative outcome:

- provider receipt or transaction ID;
- booking record;
- sent-message delivery status;
- account setting read-back;
- reconciled task/owner state.

A UI toast or accepted command alone is insufficient for an external side effect. Current approval-resume behavior is not complete across every packaged Kaki path.

## Denial and expiry

A denial ends the pending decision and must not produce a grant. Expired approvals require new facts and a new card. Never extend an old approval by editing timestamps or ledger data.

If the request is still wanted, restart it from the last safe reversible step and review the newly generated facts.

## Automatic payments

The policy implementation can automatically allow a known-payee SGD payment strictly below the configured cap. Non-SGD amounts, unknown payees, missing/invalid amounts, and most money actions ask or deny.

For evaluation:

- set the automatic cap to `0`;
- keep wallet balances and provider caps near zero;
- use fixture data rather than a live transfer;
- test hard-limit, unknown-payee, stale-facts, denial, and replay cases.

Do not interpret a policy decision as a guarantee that every skill or runtime path enforces it. Verify the exact owner/skill path before granting meaningful authority.

## Incident response

If an approval appears to have been bypassed:

1. stop risky work at the Gateway, channel, credential, or provider boundary;
2. preserve approval and audit records;
3. record the exact commit, task ID, approval ID, and redacted reason code;
4. revoke or restrict affected provider sessions;
5. reconcile whether any external action completed;
6. do not resume until the exact path has a regression test and verified fix.

The `/pause` flag alone is not a universal kill switch. See [Security](/kaki/security) and [Operations](/kaki/operations).