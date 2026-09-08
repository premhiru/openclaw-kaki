---
summary: "Prepare checkout from actual page fields and approve supported payments with Link."
read_when:
  - You want Kaki to complete a booking or online purchase
  - You need to connect Link or understand checkout handoffs
title: "Bookings and checkout"
---

Kaki can inspect a booking or checkout page, ask for the information that page requires, and prepare a purchase for review. Supported payments use an optional Link CLI integration. Payment approval happens in Link, and a merchant confirmation is required before Kaki reports a completed booking.

## Before you begin

Use a configured, running Kaki plugin and a trusted owner session with host browser control. The `kaki_checkout` tool is available to the owner outside a sandbox; no additional Kaki configuration key is required. The page must be accessible in that browser; a link in a separate browser or on your phone does not transfer its logged-in checkout session.

Link is optional. Install the supported [Stripe Link CLI](https://github.com/stripe/link-cli#installation) on the Gateway host only when you want this payment provider:

```bash
npm install -g @stripe/link-cli@0.17.3
```

Ensure `link-cli` is on the Gateway process PATH. Ask Kaki to connect Link; the checkout tool's `connect` action returns a verification URL and code. Open that URL yourself to connect your own account. Keep account credentials and bank authentication in Link or your bank.

Stripe currently limits Link CLI to US Link accounts. Its published default limits are US$500 per transaction and US$500 daily, but account limits can differ. Kaki currently supports only USD purchases up to US$500 per purchase, even if Link grants a higher limit. Check the current account limits and verification requirements rather than treating these documentation values as a guarantee. Kaki uses virtual cards for standard checkout forms; Link Pay Tokens are not implemented. See [Stripe availability and limits](https://github.com/stripe/link-cli#limits).

## Prepare the actual checkout

Ask Kaki to prepare the selected booking or purchase. Kaki inspects the current page and asks for missing information from its visible fields, including required formats and available choices. It should not ask a fixed passport questionnaire for every flight or invent fields that the merchant has not requested.

For example, if the page requests a passenger name, contact email, and nationality, Kaki asks for those details. After filling them, it inspects the page again to find validation errors or conditional fields. Optional extras remain optional; Kaki should ask before adding paid baggage, insurance, seats, or subscriptions.

Ordinary contact and delivery details can be supplied in chat with permission to send them to the named merchant. For supported sensitive identity fields, Kaki can generate a private input form from the detected fields. Open the returned `/api/kaki/checkout/input` path on your own Gateway origin through HTTPS or a localhost tunnel. The static page can load without authentication, but loading fields and submitting details require your dashboard access token. Enter that token only on your trusted Gateway page; the page keeps it in memory, not browser storage. The link also contains a single-use reference in its fragment that expires after ten minutes. Sharing the link in WhatsApp does not make the Gateway publicly accessible. If you cannot open that form, enter the details directly on the merchant page. Use Link, your bank, or the merchant page for card details, passwords, and OTPs. The form is not a reusable passport vault. A screenshot is not a required first step when Kaki can inspect the page directly.

## Checkout actions

The agent uses `inspect` to read fields, `fill` for ordinary answers, `input_link` to generate the private input path, and `prepare` for the reviewed purchase. `status` checks the pending workflow, `pay` handles a supported approved payment, and `cancel` stops the pending workflow. `connect` starts Link account connection. Use the current tool schema for required arguments; scan references belong to the inspected page and session.

## Review and approve

Before payment, Kaki presents the merchant, purchase or itinerary, final amount and currency, and relevant baggage, delivery, refund, and cancellation terms. Missing or ambiguous totals need clarification from the merchant page before proceeding.

You approve the exact payment request through Link. A message in WhatsApp or a household automatic-payment cap does not replace Link approval. If the amount, merchant, currency, itinerary, or other agreed terms change, Kaki prepares a new review instead of reusing the earlier approval.

After approval, Kaki attempts the supported checkout submission once. The tool returns `submitted_unverified`; it does not verify the receipt automatically. Kaki then uses its available browser tools to inspect the merchant confirmation and booking or order reference before reporting success. If the confirmation is inaccessible or ambiguous, Kaki asks you to check the merchant or Link activity; it must not repeat the purchase to resolve uncertainty. A Link approval or issued virtual card is permission to pay, not a receipt.

## Resolve a handoff

If Link is unavailable, your account or amount is unsupported, or the checkout cannot be filled reliably, Kaki explains what is ready and gives you the merchant checkout to finish. A bank challenge, CAPTCHA, or identity request may also need your action. This implementation declines automated payment when the scan finds visible embedded frames, unsupported custom controls, or incomplete page coverage, including otherwise valid merchant checkouts. Hidden background frames do not by themselves block checkout.

If a submission times out or the result is unclear, check the merchant order history or receipt before attempting another purchase. Do not ask Kaki to repeat the final click merely because confirmation was slow. Canceling Kaki's pending workflow is not cancellation or refund of an order already accepted by the merchant. Kaki permits one unresolved checkout per conversation. The status action displays the recorded stage and current Link status. Preparing another purchase reconciles the earlier request with Link automatically. A provider-confirmed successful payment permits a different checkout while retaining the earlier record and blocking another purchase on the same checkout. A request that Link confirms as canceled, denied, expired, or failed can be released only when it was never submitted. Uncertain creation and submission outcomes remain blocked; inspect the merchant and Link activity instead of bypassing that protection.

## Verify before relying on it

First inspect a test checkout and confirm that Kaki asks only for its missing fields. Check a conditional field and a validation error. Confirm that sensitive fields trigger private entry and that a rejected or changed payment does not submit.

Fixture tests establish the implementation's behavior under controlled inputs. They do not prove your Link account, live merchant, browser session, or bank authentication works. Verify one explicitly authorized purchase in the intended environment before relying on unattended preparation; every Link purchase still needs approval.

See [Use Kaki](/kaki/using-kaki), [Approvals](/kaki/approvals), and [Known limitations](/kaki/limitations).
