---
summary: "Evaluate Kaki data providers, browser and phone surfaces, models, and live-readiness evidence."
read_when:
  - You are connecting an external service
  - You need to distinguish fixtures from live readiness
  - You are planning a browser, phone, data, or model workflow
title: "Kaki integrations"
---

Kaki combines OpenClaw owners with Kaki regional packages and playbooks. The repository contains broad contracts and deterministic fixtures, but an integration is operational only after the exact account, environment, and bounded workflow pass a live probe.

## Readiness ladder

Use these terms precisely:

| State | Evidence |
| --- | --- |
| Described | A playbook or engineering contract exists |
| Implemented | Executable code exists behind a typed boundary |
| Fixture-tested | Deterministic tests cover expected and failure behavior |
| Clean-install tested | A fresh supported runner can install and configure it |
| Live-probed | One bounded call worked for this exact account/environment |
| Operational | Monitoring, limits, recovery, terms, and ownership are documented |

Never label an integration “ready” based only on configuration, a SecretRef, or a green fixture.

## OpenClaw-owned services

OpenClaw remains authoritative for:

- Gateway authentication and sessions;
- model providers;
- standard messaging channels;
- browser runtime;
- dashboard hosting;
- standard CLI status and approval commands.

Use the corresponding OpenClaw documentation for provider-specific login and configuration. Kaki adds household references and projections but cannot prove those owners are healthy.

## Singapore data packages

The Kaki source includes clients/contracts for LTA, OneMap, data.gov.sg/NEA-style public data, public services, SGQR, addresses, and monitor evaluation. These packages apply bounded HTTP, normalization, cache, or provenance contracts where implemented.

Before a live probe:

1. confirm the official provider and current terms;
2. provision the least-privileged credential;
3. verify endpoint, timeout, rate limit, and source timestamp;
4. use a harmless read-only query;
5. confirm stale/unavailable data is labelled rather than invented;
6. remove or rotate evaluation credentials afterward.

The required `ltaDataMall` and `oneMap` SecretRefs resolving during onboarding does not mean the plugin has wired and verified those providers end to end.

## Regional data and QR

The regional package includes profiles, QR/EMV parsing, capability metadata, and handoff contracts for Southeast Asian rails. A decoded QR payload is untrusted input until format, checksum, merchant/payee, amount, currency, and destination are independently confirmed.

Kaki must not ask for or store bank credentials. Payments require a human-controlled bank or wallet handoff and an exact approval boundary. Do not run a live transfer as an integration test.

## Browser workflows

Use browser automation for web-only preparation when a stable API is unavailable. The safe pattern is:

1. open the expected domain in a dedicated profile;
2. authenticate directly without exposing credentials to the model;
3. inspect and prepare the action;
4. stop before submission, disclosure, booking, or payment;
5. present material facts for approval;
6. commit once;
7. read back the authoritative result.

Treat page content, downloads, instructions, and support chat as untrusted. Captchas, OTPs, Singpass, digital tokens, and ambiguous identity checks require human handoff.

A checked-in browser playbook does not prove current selectors, anti-bot behavior, or provider terms.

## Phone workflows

Kaki contains an ADB/companion phone-node package and 11 mobile playbooks. However, the current packaged Android handler and Kaki companion do not share a complete supported command contract. Physical Android control is experimental/incomplete.

Do not use it on banking, wallet, Singpass, government identity, medical, or production household accounts. Harmless screenshot/tap fixtures are not end-to-end device proof.

## Models and speech

Kaki uses OpenClaw model owners plus Kaki routing, normalization, audio, cost, safety, and embedding packages. Model suitability depends on the configured provider, locale, privacy needs, and task risk.

Verify models with non-sensitive prompts. Verify ASR with synthetic or consented, non-private audio. Never use model output as the final authority for payment facts, government requirements, medical guidance, legal obligations, or provider status.

The recorded monthly model budget and `/cost` projection are not universal billing enforcement. Use provider-side spending limits and alerts.

## Messaging providers

Telegram commands have Kaki-specific owner tests. WhatsApp login, standard channels, delivery, rate limits, and account terms remain provider/OpenClaw responsibilities.

For every channel, verify:

- account authentication;
- sender/group allowlist;
- owner mapping;
- one harmless inbound and outbound message;
- unknown-sender rejection;
- disconnect and rate-limit behavior.

See [Channels](/kaki/channels).

## Government and identity services

Skills mentioning Singpass, MyInfo, CPF, IRAS, HDB, ICA, HealthHub, MyJPJ, LHDN, BPJS, VNeID, eGovPH, or similar services are guided workflows, not claims of official integration.

Rules:

- use official sites/apps and verify the domain/publisher;
- keep authentication human-controlled;
- never store passwords, digital-token approvals, reusable OTPs, or identity documents in Kaki memory;
- stop before submission or disclosure;
- re-check official instructions at the time of use;
- record only redacted, minimum evidence.

## Commerce, travel, and delivery

Grab, Gojek, Foodpanda, Shopee, Lazada, Amazon, Carousell, airlines, hotels, and booking sites change frequently and may prohibit automation. Confirm current terms before use. Prefer comparison and preparation; keep order/booking submission human-controlled during evaluation.

## Integration checklist

For each live service, record privately:

- owner and purpose;
- account and least privilege;
- source commit;
- region and locale;
- configured reference IDs (not values);
- terms/rate-limit review date;
- last successful read-only probe;
- timeout and failure behavior;
- approval boundary;
- revocation/recovery steps;
- evidence retention limit.

## Troubleshoot by boundary

| Failure | Diagnose first |
| --- | --- |
| Config reference resolves but owner is unavailable | Plugin/runtime-owner wiring |
| Owner exists but provider rejects request | Credential, scope, endpoint, terms, or rate limit |
| Data returns but looks wrong | Source timestamp, locale, normalization, units |
| Browser stops before commit | Expected approval/handoff or page drift |
| Phone command unavailable | Known contract mismatch |
| Model works but cost is unexpected | Provider billing and routing; Kaki projection is incomplete |

See [Testing and evidence](/kaki/testing) before promoting an integration to household use.