import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { checkoutInputPage, createCheckoutInputHandler } from "./checkout-input.js";
import type { KakiCheckoutOwner } from "./checkout-owner.js";

async function fixture(run: (base: string, owner: ReturnType<typeof mockOwner>) => Promise<void>) {
  const owner = mockOwner();
  const handler = createCheckoutInputHandler(() => owner as unknown as KakiCheckoutOwner);
  const server = createServer((req, res) => {
    void (req.url === "/input" ? checkoutInputPage(req, res) : handler(req, res)).catch(() => {
      res.statusCode = 500;
      res.end("Test handler failed");
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, owner);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
function mockOwner() {
  return {
    inputFields: vi.fn(() => ({ merchant: "https://merchant.example", fields: [] })),
    submitInput: vi.fn(async () => ({ ok: true, message: "Details sent." })),
  };
}
function post(base: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Kaki-Intent": "checkout-input", ...headers },
    body: JSON.stringify(body),
  });
}

// Owner tests cover token lifecycle. These cover the actual HTTP boundary: a
// guard regression must not reach the owner or disclose its sensitive error.
describe("checkout private input HTTP boundary", () => {
  it("serves a non-cacheable static shell with restrictive executable policy", async () => {
    await fixture(async (base, owner) => {
      const response = await fetch(`${base}/input`);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      const policy = response.headers.get("content-security-policy")!;
      expect(policy).toContain("default-src 'none'");
      expect(policy).toContain("connect-src 'self'");
      expect(policy).toContain("frame-ancestors 'none'");
      const nonce = /script-src 'nonce-([^']+)'/.exec(policy)?.[1];
      expect(nonce).toBeTruthy();
      expect(html).toContain(`<script nonce="${nonce}">`);
      expect(html).not.toMatch(/localStorage|sessionStorage/);
      expect(html).toContain("isSecureContext");
      expect(html).toContain("Kaki dashboard access token");
      expect(html).not.toContain("https://merchant.example");
      expect(owner.inputFields).not.toHaveBeenCalled();
      expect((await fetch(`${base}/input`, { method: "POST" })).status).toBe(405);
    });
  });

  it.each<{ label: string; headers: Record<string, string>; status: number }>([
    { label: "cross-origin", headers: { Origin: "https://attacker.example" }, status: 403 },
    { label: "missing intent", headers: { "X-Kaki-Intent": "" }, status: 400 },
    { label: "wrong content type", headers: { "Content-Type": "text/plain" }, status: 415 },
  ])("rejects $label before field access", async ({ headers, status }) => {
    await fixture(async (base, owner) => {
      const response = await post(base, { action: "fields", token: "test-reference" }, headers);
      expect(response.status).toBe(status);
      expect(owner.inputFields).not.toHaveBeenCalled();
      expect(owner.submitInput).not.toHaveBeenCalled();
    });
  });

  it.each([
    { action: "fields" },
    {
      action: "submit",
      token: "test-reference",
      consent: false,
      answers: { passport: "synthetic" },
    },
    { action: "submit", token: "test-reference", consent: true, answers: { passport: 42 } },
    {
      action: "submit",
      token: "test-reference",
      consent: true,
      answers: { passport: "x".repeat(2001) },
    },
  ])("rejects invalid input without submitting", async (body) => {
    await fixture(async (base, owner) => {
      expect((await post(base, body)).status).toBe(400);
      expect(owner.submitInput).not.toHaveBeenCalled();
    });
  });

  it("accepts same-origin consent and sanitizes expired or failed owner responses", async () => {
    await fixture(async (base, owner) => {
      const body = {
        action: "submit",
        token: "test-reference",
        consent: true,
        answers: { passport: "synthetic-passport" },
      };
      const accepted = await post(base, body, { Origin: base });
      expect(accepted.status).toBe(200);
      expect(owner.submitInput).toHaveBeenCalledWith("test-reference", {
        passport: "synthetic-passport",
      });
      owner.submitInput.mockRejectedValueOnce(new Error("synthetic-passport leaked by merchant"));
      const failed = await post(base, body);
      expect(failed.status).toBe(409);
      expect(await failed.text()).not.toContain("synthetic-passport");
      owner.inputFields.mockImplementationOnce(() => {
        throw new Error("private expired token");
      });
      const expired = await post(base, { action: "fields", token: "test-reference" });
      expect(expired.status).toBe(409);
      expect(await expired.text()).not.toContain("private expired token");
    });
  });
});
