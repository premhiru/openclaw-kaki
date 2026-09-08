import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { describe, expect, it, vi } from "vitest";
import type { KakiCheckoutOwner } from "./checkout-owner.js";
import { createKakiCheckoutTool } from "./checkout-tool.js";

const context: OpenClawPluginToolContext = {
  sessionKey: "owner-session",
  sessionId: "conversation-a",
  senderIsOwner: true,
};

// Lifecycle and sensitive-field enforcement belong to owner tests. These
// protect host-only tool admission, untrusted model arguments, and session scope.
describe("checkout model tool boundary", () => {
  it.each<OpenClawPluginToolContext>([
    {},
    { sessionKey: "owner-session" },
    { ...context, senderIsOwner: false },
    { ...context, sandboxed: true },
    { ...context, browser: { allowHostControl: false } },
    { ...context, browser: { sandboxBridgeUrl: "http://sandbox.example" } },
  ])("does not expose payment authority to an ineligible context", (blocked) => {
    const resolve = vi.fn();
    expect(createKakiCheckoutTool(blocked, resolve)).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    { action: "unknown" },
    { action: "connect", senderIsOwner: true },
    { action: "fill", snapshotId: "scan", answers: { email: 42 } },
    { action: "prepare", currency: "sgd", amount: 100 },
    { action: "prepare", currency: "usd", amount: 50001 },
    { action: "inspect", targetId: "x".repeat(257) },
  ])("rejects invalid model arguments before resolving the service", async (raw) => {
    const resolve = vi.fn();
    const tool = createKakiCheckoutTool(context, resolve)!;
    await expect(tool.execute("call", raw)).rejects.toThrow("Invalid checkout action");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("routes ordinary and protected input through the same conversation owner", async () => {
    const fill = vi.fn(async () => ({ snapshotId: "next-scan" }));
    const inputLink = vi.fn(async () => ({ path: "/api/kaki/checkout/input#test-reference" }));
    const owner = { fill, inputLink } as unknown as KakiCheckoutOwner;
    const tool = createKakiCheckoutTool(context, () => owner)!;
    await tool.execute("call", {
      action: "fill",
      snapshotId: "scan",
      answers: { email: "user@example.com" },
    });
    expect(fill).toHaveBeenCalledWith(
      "owner-session\0conversation-a",
      "scan",
      { email: "user@example.com" },
      undefined,
    );
    fill.mockRejectedValueOnce(new Error("Use the protected input form"));
    await expect(
      tool.execute("call", {
        action: "fill",
        snapshotId: "scan",
        answers: { passport: "synthetic" },
      }),
    ).rejects.toThrow("protected input");
    await tool.execute("call", { action: "input_link", snapshotId: "scan" });
    expect(inputLink).toHaveBeenCalledWith("owner-session\0conversation-a", "scan", undefined);
    const another = createKakiCheckoutTool(
      { ...context, sessionId: "conversation-b" },
      () => owner,
    )!;
    await another.execute("call", { action: "input_link", snapshotId: "scan" });
    expect(inputLink).toHaveBeenLastCalledWith("owner-session\0conversation-b", "scan", undefined);
  });

  it("fails visibly when unavailable and never resolves an already aborted call", async () => {
    const resolve = vi.fn(() => undefined);
    const tool = createKakiCheckoutTool(context, resolve)!;
    await expect(tool.execute("call", { action: "connect" })).rejects.toThrow("Finish onboarding");
    resolve.mockClear();
    const controller = new AbortController();
    controller.abort(new Error("turn canceled"));
    await expect(tool.execute("call", { action: "connect" }, controller.signal)).rejects.toThrow(
      "turn canceled",
    );
    expect(resolve).not.toHaveBeenCalled();
  });
});
