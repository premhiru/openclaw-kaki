import type { PluginStateKeyedStore } from "openclaw/plugin-sdk/plugin-state-runtime";
import { describe, expect, it, vi } from "vitest";
import type { CheckoutField, CheckoutScan } from "./checkout-browser.js";
import type { CheckoutLinkProvider, LinkCheckoutCard } from "./checkout-link.js";
import { KakiCheckoutOwner, type CheckoutRecord } from "./checkout-owner.js";

function memoryStore(): PluginStateKeyedStore<CheckoutRecord> {
  const rows = new Map<string, CheckoutRecord>();
  const copy = (value: CheckoutRecord | undefined) => value && structuredClone(value);
  return {
    register: async (key, value) => {
      rows.set(key, structuredClone(value));
    },
    registerIfAbsent: async (key, value) => {
      if (rows.has(key)) {
        return false;
      }
      rows.set(key, structuredClone(value));
      return true;
    },
    update: async (key, update) => {
      const next = update(copy(rows.get(key)));
      if (!next) {
        return false;
      }
      rows.set(key, structuredClone(next));
      return true;
    },
    deleteIf: async (key, predicate) => {
      const row = copy(rows.get(key));
      return row && predicate(row) ? rows.delete(key) : false;
    },
    lookup: async (key) => copy(rows.get(key)),
    consume: async (key) => {
      const row = copy(rows.get(key));
      rows.delete(key);
      return row;
    },
    delete: async (key) => rows.delete(key),
    entries: async () =>
      [...rows].map(([key, value]) => ({ key, value: structuredClone(value), createdAt: 1 })),
    clear: async () => {
      rows.clear();
    },
  };
}
async function storedStage(store: PluginStateKeyedStore<CheckoutRecord>) {
  const value = (await store.entries()).find((entry) => entry.value.kind === "payment")?.value;
  return value?.kind === "payment" ? value.stage : undefined;
}
function field(id: string, sensitivity: CheckoutField["sensitivity"]): CheckoutField {
  return {
    id,
    label: id,
    sensitivity,
    group: "Passenger",
    type: "text",
    autocomplete: "",
    required: false,
    filled: false,
    invalid: false,
    options: [],
    constraints: {},
  };
}
function fixture(store = memoryStore()) {
  let sequence = 0;
  let fingerprint = "price-100";
  let paused = false;
  const page = (): CheckoutScan => ({
    targetId: "tab-1",
    snapshotId: `scan-${++sequence}`,
    url: "https://merchant.example/checkout",
    pageFingerprint: fingerprint,
    fields: [
      field("name", "ordinary"),
      field("passport", "identity"),
      field("card", "payment"),
      field("otp", "authentication"),
    ],
    buttons: [{ id: "purchase", label: "Pay USD 1.00", disabled: false }],
    coverage: { frames: 0, truncated: false, customControls: 0 },
  });
  const browser = {
    inspect: vi.fn(async (targetId = "tab-1") => ({ ...page(), targetId })),
    fill: vi.fn(async () => page()),
    fillPayment: vi.fn(async () => page()),
    submit: vi.fn(async () => ({ submitted: true as const })),
  };
  const approved = { id: "lsrq_123", status: "approved", amount: 100, currency: "usd" };
  const card: LinkCheckoutCard = {
    number: "4000009990001984",
    cvc: "123",
    exp_month: 12,
    exp_year: 2030,
  };
  const link = {
    create: vi.fn(async () => ({ ...approved, status: "created" })),
    requestApproval: vi.fn(async () => ({
      id: "lsrq_123",
      approvalUrl: "https://app.link.com/approve/test",
    })),
    retrieve: vi.fn(async () => ({ ...approved })),
    consumeCredential: vi.fn(
      async (
        _id: string,
        _expected: { amount: number; currency: string },
        callback: (value: LinkCheckoutCard) => Promise<unknown>,
      ) => callback(card),
    ),
    cancel: vi.fn(async () => ({ ...approved, status: "canceled" })),
    status: vi.fn(async () => ({ installed: true, authenticated: true })),
    connect: vi.fn(async () => ({ authenticated: true })),
  };
  const ready = async () => {
    if (paused) {
      throw new Error("owner-paused");
    }
  };
  const owner = new KakiCheckoutOwner(
    browser,
    link as unknown as CheckoutLinkProvider,
    store,
    ready,
  );
  const prepare = async (session = "session-a") => {
    const scan = await owner.inspect(session, "tab-1");
    return owner.prepare(session, {
      snapshotId: scan.snapshotId,
      buttonId: "purchase",
      amount: 100,
      currency: "usd",
      summary: "One item, including all taxes and fees.",
    });
  };
  return {
    owner,
    browser,
    link,
    prepare,
    store,
    page,
    ready,
    setPrice: () => {
      fingerprint = "price-200";
    },
    pause: () => {
      paused = true;
    },
  };
}

// New owner boundary: protects private input routing, authoritative lifecycle,
// and durable once-only submission. Existing provider/browser tests cannot cover it.
describe("Kaki checkout owner", () => {
  it("binds scans and payment records to their originating conversation", async () => {
    const f = fixture();
    const scan = await f.owner.inspect("session-a", "tab-1");
    await expect(f.owner.fill("session-b", scan.snapshotId, { name: "Passenger" })).rejects.toThrow(
      "Inspect",
    );
    expect(f.browser.fill).not.toHaveBeenCalled();
    const payment = await f.prepare();
    await expect(f.owner.pay("session-b", payment.checkoutId)).rejects.toThrow("does not belong");
    await expect(f.owner.cancel("session-b", payment.checkoutId)).rejects.toThrow(
      "does not belong",
    );
    expect(f.link.consumeCredential).not.toHaveBeenCalled();
    expect(f.link.cancel).not.toHaveBeenCalled();
  });

  it("accepts identity only through a single-use protected input token", async () => {
    const f = fixture();
    const scan = await f.owner.inspect("session-a", "tab-1");
    await expect(
      f.owner.fill("session-a", scan.snapshotId, { passport: "synthetic-passport" }),
    ).rejects.toThrow("protected input");
    const form = await f.owner.inputLink("session-a", scan.snapshotId);
    const token = form.path.split("#")[1]!;
    expect(f.owner.inputFields(token).fields.map((item) => item.id)).toEqual(["name", "passport"]);
    await expect(f.owner.submitInput(token, { card: "synthetic-card" })).rejects.toThrow(
      "Unsupported",
    );
    await expect(
      f.owner.submitInput(token, { passport: "synthetic-passport" }),
    ).resolves.toMatchObject({ ok: true });
    await expect(f.owner.submitInput(token, { passport: "second-value" })).rejects.toThrow(
      "expired",
    );
    expect(f.browser.fill).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await f.store.entries())).not.toContain("synthetic-passport");
  });

  it("rejects stale protected forms after another inspection", async () => {
    const f = fixture();
    const scan = await f.owner.inspect("session-a", "tab-1");
    const form = await f.owner.inputLink("session-a", scan.snapshotId);
    await f.owner.inspect("session-a", "tab-1");
    await expect(
      f.owner.submitInput(form.path.split("#")[1]!, { name: "Passenger" }),
    ).rejects.toThrow("Inspect");
    expect(f.browser.fill).not.toHaveBeenCalled();
  });

  it.each(["pause", "close", "abort"])(
    "revalidates %s after card entry before the purchase click",
    async (mode) => {
      const f = fixture();
      const payment = await f.prepare();
      const abort = new AbortController();
      f.browser.fillPayment.mockImplementationOnce(async () => {
        if (mode === "pause") {
          f.pause();
        }
        if (mode === "close") {
          f.owner.close();
        }
        if (mode === "abort") {
          abort.abort();
        }
        return f.page();
      });
      await expect(f.owner.pay("session-a", payment.checkoutId, abort.signal)).rejects.toThrow();
      expect(f.browser.submit).not.toHaveBeenCalled();
      expect(await storedStage(f.store)).toBe("executing");
    },
  );

  it("claims one concurrent payment attempt and keeps that claim across restart", async () => {
    const f = fixture();
    const payment = await f.prepare();
    const attempts = await Promise.allSettled([
      f.owner.pay("session-a", payment.checkoutId),
      f.owner.pay("session-a", payment.checkoutId),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(f.browser.submit).toHaveBeenCalledTimes(1);
    f.owner.close();
    const restarted = new KakiCheckoutOwner(
      f.browser,
      f.link as unknown as CheckoutLinkProvider,
      f.store,
      f.ready,
    );
    await expect(restarted.pay("session-a", payment.checkoutId)).rejects.toThrow("not pending");
    expect(f.browser.submit).toHaveBeenCalledTimes(1);
  });

  it("does not retry a purchase when the merchant submit result is unknown", async () => {
    const f = fixture();
    const payment = await f.prepare();
    f.browser.submit.mockRejectedValueOnce(new Error("merchant connection lost after click"));
    await expect(f.owner.pay("session-a", payment.checkoutId)).rejects.toThrow();
    const restarted = new KakiCheckoutOwner(
      f.browser,
      f.link as unknown as CheckoutLinkProvider,
      f.store,
      f.ready,
    );
    await expect(restarted.pay("session-a", payment.checkoutId)).rejects.toThrow("not pending");
    expect(f.browser.submit).toHaveBeenCalledTimes(1);
    expect(await storedStage(f.store)).toBe("executing");
  });

  it.each(["before payment", "during card entry"])("stops a changed price %s", async (when) => {
    const f = fixture();
    const payment = await f.prepare();
    if (when === "before payment") {
      f.setPrice();
    } else {
      f.browser.fillPayment.mockImplementationOnce(async () => {
        f.setPrice();
        return f.page();
      });
    }
    await expect(f.owner.pay("session-a", payment.checkoutId)).rejects.toThrow("changed");
    expect(f.browser.submit).not.toHaveBeenCalled();
  });

  it("preserves the creation claim after unknown Link response and across restart", async () => {
    const f = fixture();
    f.link.create.mockRejectedValueOnce(new Error("network outcome unknown"));
    await expect(f.prepare()).rejects.toThrow("unknown");
    expect(await storedStage(f.store)).toBe("creating");
    await expect(f.prepare()).rejects.toThrow("already has");
    const restarted = new KakiCheckoutOwner(
      f.browser,
      f.link as unknown as CheckoutLinkProvider,
      f.store,
      f.ready,
    );
    const status = await restarted.status("session-a");
    expect(status).toMatchObject({
      stage: "creating",
      message: expect.stringContaining("uncertain"),
    });
    expect(f.link.create).toHaveBeenCalledTimes(1);
  });
  it("deduplicates the same checkout across conversations and browser tabs", async () => {
    const f = fixture();
    const first = await f.owner.inspect("session-a", "tab-1");
    const second = await f.owner.inspect("session-b", "tab-2");
    const details = {
      buttonId: "purchase",
      amount: 100,
      currency: "usd",
      summary: "One item with taxes.",
    };
    const results = await Promise.allSettled([
      f.owner.prepare("session-a", { ...details, snapshotId: first.snapshotId }),
      f.owner.prepare("session-b", { ...details, snapshotId: second.snapshotId }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(f.link.create).toHaveBeenCalledTimes(1);
    expect(
      (await f.store.entries()).filter((entry) => entry.value.kind === "payment"),
    ).toHaveLength(1);
    expect(
      (await f.store.entries()).filter((entry) => entry.value.kind === "surface"),
    ).toHaveLength(1);
  });

  it("keeps successful surfaces claimed while allowing a genuinely new checkout and retaining history", async () => {
    const f = fixture();
    const first = await f.prepare();
    await f.owner.pay("session-a", first.checkoutId);
    f.link.retrieve.mockResolvedValue({
      id: "lsrq_123",
      status: "succeeded",
      amount: 100,
      currency: "usd",
    });
    await expect(f.prepare()).rejects.toThrow("already has a payment request");
    f.setPrice();
    const second = await f.prepare();
    expect(second.checkoutId).not.toBe(first.checkoutId);
    expect(f.link.create).toHaveBeenCalledTimes(2);
    expect(await f.owner.status("session-a", first.checkoutId)).toMatchObject({
      checkoutId: first.checkoutId,
      stage: "settled",
      message: expect.stringContaining("does not prove a booking"),
    });
    expect(
      (await f.store.entries()).filter((entry) => entry.value.kind === "payment"),
    ).toHaveLength(2);
    expect(
      (await f.store.entries()).filter((entry) => entry.value.kind === "surface"),
    ).toHaveLength(2);
  });

  it("releases only provider-confirmed cancellation and preserves the old request by id", async () => {
    const f = fixture();
    const first = await f.prepare();
    await f.owner.cancel("session-a", first.checkoutId);
    expect(await f.owner.status("session-a", first.checkoutId)).toMatchObject({
      stage: "canceled",
    });
    const second = await f.prepare();
    expect(second.checkoutId).not.toBe(first.checkoutId);
    expect(f.link.create).toHaveBeenCalledTimes(2);
    expect(
      (await f.store.entries()).filter((entry) => entry.value.kind === "payment"),
    ).toHaveLength(2);
  });

  it("blocks a different checkout after uncertain submission and after unconfirmed cancellation", async () => {
    const f = fixture();
    const first = await f.prepare();
    f.browser.submit.mockRejectedValueOnce(new Error("lost after submission"));
    await expect(f.owner.pay("session-a", first.checkoutId)).rejects.toThrow();
    f.setPrice();
    await expect(f.prepare()).rejects.toThrow("already has a payment request");
    expect(f.link.create).toHaveBeenCalledTimes(1);
    const canceled = fixture();
    const request = await canceled.prepare();
    canceled.link.cancel.mockRejectedValueOnce(new Error("cancellation outcome unknown"));
    await expect(canceled.owner.cancel("session-a", request.checkoutId)).rejects.toThrow();
    canceled.setPrice();
    await expect(canceled.prepare()).rejects.toThrow("already has a payment request");
    expect(canceled.link.create).toHaveBeenCalledTimes(1);
  });
  it.each(["uninstalled", "unauthenticated", "http"])(
    "leaves no durable claim when payment preflight is %s",
    async (mode) => {
      const f = fixture();
      if (mode === "http") {
        f.browser.inspect.mockImplementation(async (targetId = "tab-1") => ({
          ...f.page(),
          targetId,
          url: "http://merchant.example/checkout",
        }));
      } else {
        f.link.status.mockResolvedValue({
          installed: mode !== "uninstalled",
          authenticated: false,
        });
      }
      await expect(f.prepare()).rejects.toThrow(mode === "http" ? "HTTPS" : "Connect Link");
      expect(await f.store.entries()).toEqual([]);
      expect(f.link.create).not.toHaveBeenCalled();
      f.browser.inspect.mockImplementation(async (targetId = "tab-1") => ({
        ...f.page(),
        targetId,
      }));
      f.link.status.mockResolvedValue({ installed: true, authenticated: true });
      await expect(f.prepare()).resolves.toMatchObject({ checkoutId: expect.any(String) });
    },
  );
});
