---
summary: "Run Kaki's test, evaluation, security, documentation, and release-evidence gates."
read_when:
  - You are validating a Kaki change or deployment
  - You need to interpret acceptance results
  - You are preparing a release or live integration
title: "Testing and evidence"
---

Kaki uses layered evidence. Unit tests prove local behavior, fixtures prove deterministic contracts, clean-install CI proves reproducibility, and bounded operator probes prove only the exact external environment tested. No single green command proves every live service.

## Evidence model

| Evidence                | Proves                                                    | Does not prove                            |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------- |
| Static checks           | Formatting, links, types, generated catalogue consistency | Runtime behavior                          |
| Unit tests              | Functions, policy, projections, parser boundaries         | Provider/account availability             |
| QA/security tests       | Cross-package scenarios and named threat controls         | Live credentials or devices               |
| Fixture E2E             | Deterministic workflow and recovery contract              | Current website/app/provider behavior     |
| Clean-install CI        | Fresh supported host can install and onboard              | Your daemon, network, or account          |
| Bounded live probe      | One exact read-only path worked at a time                 | Long-term availability or broad authority |
| Strict release evidence | Named non-fixture gates passed for one build              | Suitability beyond documented scope       |

Always record the exact commit with evidence.

## Fast development loop

Run the narrow package test first, then broaden:

```bash
pnpm --dir kaki lint
pnpm --dir kaki typecheck
pnpm --dir kaki test
```

For one package:

```bash
pnpm --filter @kaki/security test
pnpm --filter @kaki/skills test
```

Use the package script names actually declared in that workspace.

## Complete Kaki verification

```bash
pnpm --dir kaki verify
```

The gate runs, in order:

1. lint;
2. typecheck;
3. package tests;
4. coverage checks;
5. QA tests;
6. fixture validation and E2E replay;
7. locale evaluations;
8. secret scan;
9. documentation/requirements checks;
10. acceptance report.

Stop at the first meaningful failure and preserve its output. Do not rerun until an intermittent failure looks green without classifying it.

## Individual gates

```bash
pnpm --dir kaki coverage
pnpm --dir kaki test:qa
pnpm --dir kaki test:e2e
pnpm --dir kaki evals
pnpm --dir kaki security:scan
pnpm --dir kaki docs:check
pnpm --dir kaki acceptance
```

`test:e2e` validates fixtures and replays them through the runtime adapter. It is deterministic evidence, not a live account test.

## Acceptance modes

```bash
pnpm --dir kaki acceptance
pnpm --dir kaki acceptance:release
```

Normal acceptance can report live checks as pending and still provide useful development evidence. Release acceptance is strict and must not pass without the required non-fixture evidence for the exact build.

Do not fabricate live evidence or reclassify a fixture as a provider probe.

## Clean-install validation

The dedicated Kaki workflow validates:

- frozen dependency installation;
- build and product verification;
- managed installer behavior;
- noninteractive onboarding with the safe fixture profile;
- workspace/reference activation;
- Gateway owner activation;
- Ubuntu and macOS clean paths.

A passing workflow proves the repository path at its commit. It does not validate private credentials.

## Documentation checks

```bash
pnpm --dir kaki docs:check
pnpm check:docs
pnpm exec oxfmt --check README.md docs/docs.json docs/kaki
```

Validate:

- frontmatter;
- navigation entries;
- root-relative internal links;
- no missing routes;
- JSON examples;
- exact commands and version ranges;
- capability claims against code and limitations.

## Security tests

The security scan and package tests should cover:

- secret patterns and prohibited fixture data;
- unknown/non-owner access;
- exact action schemas and request limits;
- policy decisions and hard limits;
- facts hashing, stale decisions, expiry, and replay;
- approval single-use behavior;
- redaction and household boundaries;
- hostile/untrusted input behavior.

A security test is a regression control, not a substitute for host hardening or provider caps.

## Skill tests

```bash
pnpm --filter @kaki/skills generate:check
pnpm --filter @kaki/skills typecheck
pnpm --filter @kaki/skills test
```

These verify catalogue generation, unique playbooks, meaningful fixtures, approval fencing, and dispatcher calls. They do not log into the named service.

## Live probe template

For a service that needs live evidence:

1. record commit, environment, provider, account alias, and time;
2. confirm current terms and least privilege;
3. use synthetic/non-sensitive input;
4. perform one bounded read-only call;
5. record source timestamp and sanitized outcome;
6. test a safe unavailable/denied response;
7. revoke temporary credentials if applicable;
8. store evidence privately with a retention limit.

Never use a payment, government submission, booking, external message, or account change as the first probe.

## Negative verification

Every important happy path needs a negative assertion:

| Happy path                 | Required negative check                  |
| -------------------------- | ---------------------------------------- |
| Owner command succeeds     | Non-owner gets no household projection   |
| Authenticated UI loads     | Unauthenticated request exposes no data  |
| Approval succeeds          | Stale facts return conflict              |
| Skill prepares action      | Denial prevents commit                   |
| Provider returns data      | Timeout/unavailable does not invent data |
| Dedupe sends one notice    | Replay does not duplicate it             |
| Installer writes launcher  | Unmanaged file is not overwritten        |
| Onboarding seeds workspace | Existing household files are preserved   |

## Classify failures

A failed broad CI matrix may include unrelated upstream, fork-identity, provider, or runner failures. Classify from logs and prove the relevant path independently. Do not hide a red required check or call it unrelated without evidence.

For landing:

- pin the exact head SHA;
- ensure the base has not moved unexpectedly;
- review all comments and requested changes;
- link relevant green jobs;
- document non-blocking failures with log evidence;
- use a squash merge after the landing gate is satisfied.

## Release record

Keep:

- source and merge commit;
- build/runtime versions;
- green job links;
- acceptance report;
- live-probe inventory;
- known limitations;
- migration/rollback notes;
- unresolved provider or environment risks.

The release record must not contain secrets or private household content.

See [Known limitations](/kaki/limitations) before translating evidence into a capability claim.
