---
summary: "Threat model, secret handling, access control, data minimization, and incident response for Kaki."
read_when:
  - You are preparing a live household deployment
  - You are reviewing credentials, remote access, or operator permissions
  - You suspect a secret or personal-data exposure
title: "Secure Kaki"
---

Kaki handles household context and can coordinate tools, so operate it as a privileged local service. The safest deployment minimizes credentials and authority, keeps the Gateway private, and requires a human at every identity, disclosure, booking, payment, or account-change boundary.

## Security model

Kaki relies on layered controls:

1. **Host boundary:** a trusted, patched machine and protected account.
2. **Gateway boundary:** OpenClaw authentication, scopes, sessions, and channel allowlists.
3. **Household boundary:** one private profile and state root per deployment.
4. **Plugin boundary:** exact action schemas, owner deadlines, response limits, and projected data.
5. **Policy boundary:** deterministic risk decisions and facts-bound approvals.
6. **Provider boundary:** least-privileged accounts, caps, terms, and revocation.

No single flag replaces these layers. In particular, `/pause` is not a universal kill switch.

## Threats to plan for

- unknown or compromised channel senders;
- prompt injection in messages, web pages, files, quoted content, and support chats;
- leaked model/channel/data-provider credentials;
- household data crossing member or household boundaries;
- stale or substituted approval facts;
- replayed or duplicated side effects;
- public Gateway, browser, ADB, or model exposure;
- poisoned learned skills or fixtures;
- provider account bans, rate limits, or changed terms;
- sensitive diagnostics copied into public systems.

## Secrets

Kaki's onboarding profile contains SecretRefs, never resolved values. Use `env`, protected `file`, approved `exec`, or configured `store` resolution. The household memory key is 32 random bytes encoded as unpadded base64url.

Never store:

- bank or wallet passwords;
- Singpass or government identity credentials;
- reusable OTPs, recovery codes, or digital-token approvals;
- raw channel QR codes or session exports;
- payment instruments;
- private keys in Git;
- secrets in model prompts, memory, traces, fixtures, or issue attachments.

Provider/session data may still exist in OpenClaw-owned state. Protect all of `KAKI_HOME` and its backups.

## File and service permissions

Use a dedicated OS account where practical. Private profiles and secret files should be readable only by that account:

```bash
chmod 600 "$HOME/.config/kaki/profile.json"
chmod 700 "${KAKI_HOME:-$HOME/.kaki}"
```

Do not run Kaki as root merely to avoid file-permission problems. Grant device or service access narrowly and explicitly.

## Gateway exposure

Keep the Gateway bound to a trusted interface and use its authentication. For remote access, prefer a private overlay and follow OpenClaw's remote-access and proxy-trust guidance.

Never expose these directly to the public internet:

- Gateway or Kaki Control API;
- Chrome debugging endpoints;
- ADB or companion transport;
- local model endpoints;
- SQLite/state directories;
- metrics or logs containing household identifiers.

The Kaki action route requires Gateway auth, scopes, JSON, and an intent header. The header is a request guard, not authentication.

## Channel access

- allowlist household senders/groups;
- keep owner commands restricted to the configured operator;
- verify non-owner rejection;
- use dedicated assistant accounts;
- treat quoted/forwarded content as untrusted;
- separate vendor threads from private household conversation;
- stop reconnect loops on provider ban or rate limiting.

The plugin checks `isAuthorizedSender` and `senderIsOwner` for Kaki Telegram commands. Your provider and OpenClaw allowlists must still be configured correctly.

## Model and tool safety

Models propose; deterministic code authorizes. Do not let model text bypass:

- schema validation;
- tool allowlists;
- approval policy;
- provider scopes;
- payment/account hard limits;
- human-only authentication.

Prefer typed public data over browsing. Treat browser content as hostile. Stop at captcha, OTP, identity, disclosure, booking, payment, and account-change boundaries.

## Household privacy

Collect the minimum confirmed facts needed for the task. Classify member-specific information and do not reveal it to another member merely because both are in one household.

Addresses, dietary needs, commute patterns, health context, messages, and journey entries are personal data. Avoid copying them into general logs or model prompts. Diagnostic bundles should use IDs only when necessary and redact exact values.

## Approval integrity

Approvals bind exact material facts and expire. Always compare the current approval ID and SHA-256 facts hash. Reject changed, missing, or surprising facts. A grant is single-use.

Approval is not completion evidence. Reconcile the external service after commit. See [Approvals and safety](/kaki/approvals).

## Backups

A state backup can contain configuration, session data, household memory, approval records, and provider-owned credential material. Encrypt the destination, restrict access, keep it outside the source checkout, and test recovery without printing content.

Do not commit `KAKI_HOME`, profile JSON, `.env` files, database files, or channel sessions. A raw live SQLite copy may be inconsistent; stop the Gateway before the conservative filesystem backup documented in [Operations](/kaki/operations).

## Logs and diagnostics

Before sharing:

- remove profile and SecretRef values;
- remove message bodies and private addresses;
- remove QR codes, tokens, cookies, and provider responses;
- remove approval payloads/material facts;
- keep the exact source commit, OS, Node version, command, timestamp, and redacted error code.

Do not upload a full state directory to an issue.

## Incident response

If a credential or personal record may be exposed:

1. stop the affected channel/service at an enforceable boundary;
2. preserve minimum redacted evidence and timestamps;
3. revoke provider sessions and rotate credentials;
4. assess Git history, backups, logs, and model traces;
5. reconcile external actions and pending approvals;
6. notify affected people as required by law and provider terms;
7. add a regression test before restoring authority.

Do not feed an incident trace into a learning pipeline.

## Preflight checklist

Before live use, confirm:

- [ ] dedicated and patched host/account;
- [ ] protected `KAKI_HOME` and private profile;
- [ ] no secrets in Git or shell history;
- [ ] Gateway is not public;
- [ ] channel allowlists and owner mapping tested;
- [ ] non-owner rejection tested;
- [ ] automatic payment cap set to zero or a justified minimum;
- [ ] provider-side caps and alerts configured;
- [ ] denial, expiry, stale facts, and replay tested;
- [ ] backup and rollback rehearsed;
- [ ] every live integration has a bounded probe and revocation path;
- [ ] known limitations accepted explicitly.

## Report a vulnerability

Follow the repository's `SECURITY.md`. Do not open a public issue containing exploit details, tokens, household data, or provider sessions.