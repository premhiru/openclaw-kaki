import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createCheckoutBrowser } from "./checkout-browser.js";

function browserFixture(html: string) {
  const dom = new JSDOM(html, {
    url: "https://merchant.example/checkout?private=secret",
    runScripts: "outside-only",
  });
  Object.defineProperty(dom.window.crypto, "subtle", { value: webcrypto.subtle });
  dom.window.TextEncoder = TextEncoder;
  Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", {
    get() {
      return this.textContent;
    },
  });
  dom.window.Element.prototype.getClientRects = function () {
    return this.hasAttribute("hidden") ? [] : [{ width: 10, height: 10 }];
  } as typeof dom.window.Element.prototype.getClientRects;
  const browser = createCheckoutBrowser(async (method, params) => {
    expect(method).toBe("browser.request");
    expect(params.path).toBe("/act");
    const body = params.body as { fn: string };
    return { result: await dom.window.eval(`(${body.fn})()`) };
  });
  return { browser, document: dom.window.document, close: () => dom.window.close() };
}

describe("checkout managed-browser boundary", () => {
  it("discovers actual required fields without values, fills answers, and rescans conditional fields", async () => {
    const fixture = browserFixture(
      '<fieldset><legend>Passenger</legend><label>Name<input required name="name" value="Private Name"></label><label>Nationality<select required><option value="">Choose</option><option value="SG">Singapore</option></select></label><input type="hidden" value="secret"><input disabled name="unused"><label>Passport<input name="passport" required></label><label>Notes<textarea>Private Notes</textarea></label></fieldset><button>Continue</button>',
    );
    try {
      const scan = await fixture.browser.inspect("tab");
      expect(scan.url).toBe("https://merchant.example/checkout");
      expect(JSON.stringify(scan)).not.toContain("Private Name");
      expect(JSON.stringify(scan)).not.toContain("Private Notes");
      expect(scan.fields).toHaveLength(4);
      expect(scan.fields[0]).toMatchObject({
        label: "Name",
        group: "Passenger",
        filled: true,
        required: true,
      });
      expect(scan.fields[2]).toMatchObject({ sensitivity: "identity", filled: false });
      fixture.document.querySelector("select")!.addEventListener("change", () => {
        const label = fixture.document.createElement("label");
        label.innerHTML = 'Visa number<input required name="visa">';
        fixture.document.body.append(label);
      });
      const result = await fixture.browser.fill("tab", undefined, scan.snapshotId, {
        [scan.fields[1]!.id]: "SG",
      });
      expect(
        result.fields.some(
          (field) => field.label === "Visa number" && field.required && !field.filled,
        ),
      ).toBe(true);
      await expect(fixture.browser.fill("tab", undefined, scan.snapshotId, {})).rejects.toThrow(
        "snapshot-stale",
      );
    } finally {
      fixture.close();
    }
  });

  it("rejects changed quotes and protected answers before any mutation", async () => {
    const fixture = browserFixture(
      '<p>Total $100</p><label>Email<input name="email"></label><label>Card<input autocomplete="cc-number"></label><button>Pay</button>',
    );
    try {
      const scan = await fixture.browser.inspect("tab");
      await expect(
        fixture.browser.fill("tab", undefined, scan.snapshotId, {
          [scan.fields[1]!.id]: "4111111111111111",
        }),
      ).rejects.toThrow("protected-field");
      expect(fixture.document.querySelectorAll("input")[1]!.value).toBe("");
      const next = await fixture.browser.inspect("tab");
      fixture.document.querySelector("p")!.textContent = "Total $200";
      await expect(
        fixture.browser.fill("tab", undefined, next.snapshotId, {
          [next.fields[0]!.id]: "person@example.com",
        }),
      ).rejects.toThrow("page-changed");
      expect(fixture.document.querySelector("input")!.value).toBe("");
      expect((await fixture.browser.inspect("tab")).pageFingerprint).not.toBe(next.pageFingerprint);
    } finally {
      fixture.close();
    }
  });

  it("fills observed payment slots privately and consumes final submission exactly once", async () => {
    const fixture = browserFixture(
      '<input required autocomplete="cc-number"><input required autocomplete="cc-csc"><input required autocomplete="cc-exp"><input required autocomplete="cc-name"><button type="button" disabled>Pay $100</button>',
    );
    try {
      let clicks = 0;
      fixture.document.querySelector("button")!.addEventListener("click", () => {
        clicks += 1;
      });
      fixture.document.querySelector('[autocomplete="cc-name"]')!.addEventListener("change", () => {
        fixture.document.querySelector("button")!.disabled = false;
      });
      const scan = await fixture.browser.inspect("tab");
      expect(scan.buttons[0]!.disabled).toBe(true);
      const filled = await fixture.browser.fillPayment("tab", undefined, scan.snapshotId, {
        number: "4111111111111111",
        cvc: "123",
        exp_month: 12,
        exp_year: 2030,
        billing_address: { name: "Test Passenger" },
      });
      expect(JSON.stringify(filled)).not.toContain("4111111111111111");
      expect(filled.pageFingerprint).toBe(scan.pageFingerprint);
      expect(filled.fields.every((field) => field.filled)).toBe(true);
      await fixture.browser.submit("tab", undefined, filled.snapshotId, filled.buttons[0]!.id);
      await expect(
        fixture.browser.submit("tab", undefined, filled.snapshotId, filled.buttons[0]!.id),
      ).rejects.toThrow("snapshot-stale");
      expect(clicks).toBe(1);
    } finally {
      fixture.close();
    }
  });

  it("privately binds changes to already-filled passenger values before submission", async () => {
    const fixture = browserFixture(
      '<label>Passport<input required value="SYNTHETIC-A"></label><button type="button">Pay</button>',
    );
    try {
      const scan = await fixture.browser.inspect("tab");
      fixture.document.querySelector("input")!.value = "SYNTHETIC-B";
      await expect(
        fixture.browser.submit("tab", undefined, scan.snapshotId, scan.buttons[0]!.id),
      ).rejects.toThrow("page-changed");
      const next = await fixture.browser.inspect("tab");
      expect(next.pageFingerprint).not.toBe(scan.pageFingerprint);
      expect(JSON.stringify(next)).not.toContain("SYNTHETIC-B");
    } finally {
      fixture.close();
    }
  });

  it("reports inaccessible controls and prevents an apparently complete purchase", async () => {
    const fixture = browserFixture(
      '<iframe src="https://payment.example"></iframe><iframe style="display:none" src="https://antifraud.example"></iframe><input type="file" required><button type="button">Pay</button>',
    );
    try {
      const scan = await fixture.browser.inspect("tab");
      expect(scan.coverage.frames).toBe(1);
      expect(scan.coverage.customControls).toBe(1);
      expect(scan.fields).toHaveLength(0);
      await expect(
        fixture.browser.submit("tab", undefined, scan.snapshotId, scan.buttons[0]!.id),
      ).rejects.toThrow("submit-not-ready");
    } finally {
      fixture.close();
    }
  });

  it("accepts a completed required radio group and binds query-only navigation", async () => {
    const fixture = browserFixture(
      '<input type="radio" name="delivery" required><input type="radio" name="delivery" checked><button type="button">Pay</button>',
    );
    try {
      const scan = await fixture.browser.inspect("tab");
      expect(scan.fields.every((field) => field.required && field.filled && !field.invalid)).toBe(
        true,
      );
      expect(scan.fields.every((field) => field.constraints.radioGroup === "delivery")).toBe(true);
      fixture.document.defaultView!.history.replaceState(null, "", "/checkout?order=another");
      await expect(
        fixture.browser.submit("tab", undefined, scan.snapshotId, scan.buttons[0]!.id),
      ).rejects.toThrow("page-changed");
      const next = await fixture.browser.inspect("tab");
      expect(next.url).toBe(scan.url);
      expect(next.pageFingerprint).not.toBe(scan.pageFingerprint);
    } finally {
      fixture.close();
    }
  });
});
