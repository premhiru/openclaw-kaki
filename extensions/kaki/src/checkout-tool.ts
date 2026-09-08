import type { AnyAgentTool, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/provider-web-search";
import { isRecord } from "openclaw/plugin-sdk/string-coerce-runtime";
import { Type } from "typebox";
import { Value } from "typebox/value";
import type { KakiCheckoutOwner } from "./checkout-owner.js";

const schema = Type.Object(
  {
    action: Type.String({
      enum: ["inspect", "fill", "input_link", "prepare", "status", "pay", "cancel", "connect"],
    }),
    targetId: Type.Optional(Type.String({ minLength: 1, maxLength: 256 })),
    profile: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
    snapshotId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
    checkoutId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
    buttonId: Type.Optional(Type.String({ minLength: 1, maxLength: 2048 })),
    answers: Type.Optional(
      Type.Record(Type.String({ maxLength: 2048 }), Type.String({ maxLength: 2000 }), {
        maxProperties: 60,
      }),
    ),
    amount: Type.Optional(Type.Integer({ minimum: 1, maximum: 50000 })),
    currency: Type.Optional(Type.String({ enum: ["usd"] })),
    summary: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })),
  },
  { additionalProperties: false },
);
function text(raw: Record<string, unknown>, name: string): string {
  const value = raw[name];
  if (typeof value !== "string" || !value) {
    throw new Error(`Checkout requires ${name}.`);
  }
  return value;
}
export function createKakiCheckoutTool(
  context: OpenClawPluginToolContext,
  resolve: () => KakiCheckoutOwner | undefined,
): AnyAgentTool | null {
  if (
    !context.sessionKey ||
    context.senderIsOwner !== true ||
    context.sandboxed ||
    context.browser?.allowHostControl === false ||
    context.browser?.sandboxBridgeUrl
  ) {
    return null;
  }
  const session = `${context.sessionKey}\0${context.sessionId ?? ""}`;
  return {
    name: "kaki_checkout",
    label: "Kaki Checkout",
    description:
      "Inspect the current host-browser booking/checkout tab and ask only for observed missing fields. fill accepts ordinary answers; use input_link for identity details, never passwords/OTPs/card numbers in chat. prepare takes the observed final button, exact USD total in cents and non-sensitive purchase summary; Link approval is required. pay submits once, then verify the merchant confirmation. status recovers pending or uncertain attempts; never retry a purchase blindly. Link setup is optional and currently US-account/USD only.",
    parameters: schema,
    async execute(_id, raw, signal) {
      signal?.throwIfAborted();
      if (!isRecord(raw) || !Value.Check(schema, raw)) {
        throw new Error("Invalid checkout action.");
      }
      const owner = resolve();
      if (!owner) {
        throw new Error("Kaki checkout is unavailable. Finish onboarding and start the Gateway.");
      }
      const action = text(raw, "action");
      switch (action) {
        case "inspect":
          return jsonResult(
            await owner.inspect(
              session,
              text(raw, "targetId"),
              typeof raw.profile === "string" ? raw.profile : undefined,
              signal,
            ),
          );
        case "fill": {
          if (
            !isRecord(raw.answers) ||
            !Object.values(raw.answers).every((value) => typeof value === "string")
          ) {
            throw new Error("Provide ordinary answers keyed by observed field id.");
          }
          return jsonResult(
            await owner.fill(
              session,
              text(raw, "snapshotId"),
              // SAFETY: schema validation and the string-only value check above validate every answer.
              raw.answers as Record<string, string>,
              signal,
            ),
          );
        }
        case "input_link":
          return jsonResult(await owner.inputLink(session, text(raw, "snapshotId"), signal));
        case "prepare": {
          if (typeof raw.amount !== "number") {
            throw new Error("Provide the exact observed total in cents.");
          }
          return jsonResult(
            await owner.prepare(
              session,
              {
                snapshotId: text(raw, "snapshotId"),
                buttonId: text(raw, "buttonId"),
                amount: raw.amount,
                currency: text(raw, "currency"),
                summary: text(raw, "summary"),
              },
              signal,
            ),
          );
        }
        case "status":
          return jsonResult(
            await owner.status(
              session,
              typeof raw.checkoutId === "string" ? raw.checkoutId : undefined,
              signal,
            ),
          );
        case "connect":
          return jsonResult(await owner.connect(signal));
        case "pay":
          return jsonResult(await owner.pay(session, text(raw, "checkoutId"), signal));
        case "cancel":
          return jsonResult(await owner.cancel(session, text(raw, "checkoutId"), signal));
        default:
          throw new Error("Unsupported checkout action.");
      }
    },
  } satisfies AnyAgentTool;
}
