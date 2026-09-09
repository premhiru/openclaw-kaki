import { beforeEach, describe, expect, it, vi } from "vitest";
const processMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: processMock }));
import { CheckoutLinkProvider } from "./checkout-link.js";

let responses: Array<string | Error>;
beforeEach(() => {
  responses = ["0.17.3\n"];
  processMock.mockReset();
  processMock.mockImplementation(
    (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      const response = responses.shift();
      if (response instanceof Error) {
        callback(response, "", "");
      } else {
        callback(null, response ?? "{}", "");
      }
    },
  );
});
const makeProvider = () =>
  new CheckoutLinkProvider({ authFile: "/tmp/kaki-unit-only/link-auth.json" });
const pending = { id: "lsrq_123", status: "pending_approval", amount: 100, currency: "usd" };

// No existing payment boundary tests exist. These exercise the process boundary:
// upstream response changes must not expose credentials or authorize stale states.
describe("Link payment provider boundary", () => {
  it("projects array and streaming CLI responses without exposing secrets", async () => {
    const provider = makeProvider();
    responses.push(
      JSON.stringify([
        { authenticated: true, access_token: "sensitive-token", credentials_path: "private-path" },
      ]),
    );
    const status = await provider.status();
    expect(status).toMatchObject({ installed: true, authenticated: true });
    expect(JSON.stringify(status)).not.toMatch(/sensitive-token|private-path/);
    responses.push(
      JSON.stringify(pending) +
        "\n" +
        JSON.stringify({ ...pending, status: "denied", card: { number: "4000009990001984" } }),
    );
    expect(await provider.retrieve("lsrq_123")).toEqual({ ...pending, status: "denied" });
    responses.push(JSON.stringify(pending) + "\n{broken");
    await expect(provider.retrieve("lsrq_123")).rejects.toThrow("link-invalid-response");
  });

  it.each([
    "created",
    "pending_approval",
    "denied",
    "expired",
    "canceled",
    "succeeded",
    "failed",
    "requires_action",
  ])("never retrieves or consumes credentials for %s", async (status) => {
    responses.push(JSON.stringify([{ ...pending, status }]));
    const consume = vi.fn();
    await expect(
      makeProvider().consumeCredential("lsrq_123", { amount: 100, currency: "usd" }, consume),
    ).rejects.toThrow("link-payment-not-approved");
    expect(consume).not.toHaveBeenCalled();
    expect(processMock.mock.calls.some((call) => call[1].includes("--include"))).toBe(false);
  });

  it("rechecks approval on credential response and hides checkout exceptions", async () => {
    const provider = makeProvider();
    responses.push(
      JSON.stringify({ ...pending, status: "approved" }),
      JSON.stringify({ ...pending, status: "denied" }),
    );
    const consume = vi.fn();
    await expect(
      provider.consumeCredential("lsrq_123", { amount: 100, currency: "usd" }, consume),
    ).rejects.toThrow("link-payment-not-approved");
    expect(consume).not.toHaveBeenCalled();
    responses.push(
      JSON.stringify({ ...pending, status: "approved" }),
      JSON.stringify({
        ...pending,
        status: "approved",
        card: { number: "4000009990001984", cvc: "123", exp_month: 12, exp_year: 2030 },
      }),
    );
    let retained: { number: string; cvc: string } | undefined;
    await expect(
      provider.consumeCredential("lsrq_123", { amount: 100, currency: "usd" }, async (card) => {
        retained = card;
        throw new Error(`browser failed with ${card.number}`);
      }),
    ).rejects.toThrow("link-checkout-unconfirmed");
    expect(retained).toMatchObject({ number: "", cvc: "" });
  });

  it("uses isolated auth and literal argv without inherited Link overrides", async () => {
    vi.stubEnv("LINK_ACCESS_TOKEN", "wrong-household");
    vi.stubEnv("LINK_API_BASE_URL", "https://attacker.example");
    try {
      responses.push(JSON.stringify({ ...pending, status: "created" }));
      const merchantName = "Merchant $(do-not-execute)";
      await makeProvider().create({
        merchantName,
        merchantUrl: "https://merchant.example/checkout",
        context:
          "User requested this exact merchant purchase. The final checkout total includes all taxes and fees and is ready for Link approval.",
        amount: 100,
        currency: "USD",
        test: true,
      });
      const call = processMock.mock.calls.at(-1)!;
      expect(call[1]).toEqual(
        expect.arrayContaining([
          merchantName,
          "--no-request-approval",
          "--auth",
          "/tmp/kaki-unit-only/link-auth.json",
          "--test",
        ]),
      );
      expect(call[2]).toMatchObject({ shell: false, windowsHide: true });
      expect(call[2].env).not.toHaveProperty("LINK_ACCESS_TOKEN");
      expect(call[2].env).not.toHaveProperty("LINK_API_BASE_URL");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("fails closed for malformed status, unsupported currency and raw process errors", async () => {
    const provider = makeProvider();
    responses.push(JSON.stringify({ ...pending, status: "new_upstream_status" }));
    await expect(provider.retrieve("lsrq_123")).rejects.toThrow("link-invalid-response");
    responses.push(new Error("stderr contains sensitive-token"));
    await expect(provider.retrieve("lsrq_123")).rejects.toThrow("link-command-failed");
    const callCount = processMock.mock.calls.length;
    await expect(
      provider.create({
        merchantName: "Shop",
        merchantUrl: "https://merchant.example",
        context: "x".repeat(100),
        amount: 100,
        currency: "sgd",
      }),
    ).rejects.toThrow("link-unsupported-amount");
    expect(processMock).toHaveBeenCalledTimes(callCount);
  });
  it.each([{ amount: 101, currency: "usd" }, { amount: 100, currency: "eur" }, { amount: 100 }])(
    "rejects credentials whose approval facts changed to %j",
    async (facts) => {
      responses.push(
        JSON.stringify({ ...pending, status: "approved" }),
        JSON.stringify({
          id: "lsrq_123",
          status: "approved",
          ...facts,
          card: { number: "4000009990001984", cvc: "123", exp_month: 12, exp_year: 2030 },
        }),
      );
      const consume = vi.fn();
      await expect(
        makeProvider().consumeCredential("lsrq_123", { amount: 100, currency: "usd" }, consume),
      ).rejects.toThrow("link-payment-not-approved");
      expect(consume).not.toHaveBeenCalled();
    },
  );
});
