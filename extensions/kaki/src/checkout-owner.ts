import { createHash, randomUUID } from "node:crypto";
import type { PluginStateKeyedStore } from "openclaw/plugin-sdk/plugin-state-runtime";
import { createCheckoutBrowser, type CheckoutScan } from "./checkout-browser.js";
import { CheckoutLinkProvider } from "./checkout-link.js";

type Browser = ReturnType<typeof createCheckoutBrowser>;
type CheckoutPayment = {
  kind: "payment";
  id: string;
  session: string;
  targetId: string;
  profile?: string;
  url: string;
  pageFingerprint: string;
  buttonId: string;
  buttonLabel: string;
  amount: number;
  currency: string;
  summary: string;
  stage: "creating" | "pending" | "executing" | "submitted" | "canceling" | "canceled" | "settled";
  spendId?: string;
  outcome?: "succeeded" | "denied" | "expired" | "failed" | "canceled";
};
export type CheckoutRecord = CheckoutPayment | { kind: "session" | "surface"; id: string };
type InputRequest = { session: string; scan: CheckoutScan; expiresAt: number };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const paymentKey = (id: string) => `payment:${id}`;
const surfaceKey = (value: Pick<CheckoutPayment, "profile" | "url" | "pageFingerprint">) =>
  `surface:${hash(JSON.stringify([value.profile ?? "", value.url, value.pageFingerprint]))}`;
const terminal = (record: CheckoutPayment) =>
  record.stage === "settled" || record.stage === "canceled";

export class KakiCheckoutOwner {
  private active = true;
  private readonly scans = new Map<string, CheckoutScan>();
  private readonly inputs = new Map<string, InputRequest>();
  constructor(
    readonly browser: Browser,
    readonly link: CheckoutLinkProvider,
    private readonly store: PluginStateKeyedStore<CheckoutRecord>,
    private readonly checkReady: () => Promise<void>,
  ) {
    if (!store.update || !store.deleteIf) {
      throw new Error("Checkout requires atomic plugin-state updates.");
    }
  }
  close() {
    this.active = false;
    this.scans.clear();
    this.inputs.clear();
  }
  private async ready(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!this.active) {
      throw new Error("Checkout service stopped. Start a new request.");
    }
    await this.checkReady();
    signal?.throwIfAborted();
    if (!this.active) {
      throw new Error("Checkout service stopped. Start a new request.");
    }
  }
  private sessionKey(session: string) {
    return `session:${hash(session)}`;
  }
  private saveScan(session: string, scan: CheckoutScan) {
    if (this.scans.size >= 100 && !this.scans.has(session)) {
      throw new Error("Too many checkout sessions.");
    }
    this.scans.set(session, scan);
    return scan;
  }
  private scan(session: string, snapshotId: string) {
    const scan = this.scans.get(session);
    if (!scan || scan.snapshotId !== snapshotId) {
      throw new Error("Checkout changed. Inspect the current page again.");
    }
    return scan;
  }
  async inspect(session: string, targetId: string, profile?: string, signal?: AbortSignal) {
    await this.ready(signal);
    const scan = await this.browser.inspect(targetId, profile);
    await this.ready(signal);
    return this.saveScan(session, scan);
  }
  async fill(
    session: string,
    snapshotId: string,
    answers: Record<string, string>,
    signal?: AbortSignal,
  ) {
    await this.ready(signal);
    const scan = this.scan(session, snapshotId);
    for (const id of Object.keys(answers)) {
      const field = scan.fields.find((candidate) => candidate.id === id);
      if (!field || field.sensitivity !== "ordinary") {
        throw new Error(
          "Use the protected input form or enter this field directly on the merchant page.",
        );
      }
    }
    const next = await this.browser.fill(scan.targetId, scan.profile, snapshotId, answers);
    await this.ready(signal);
    return this.saveScan(session, next);
  }
  async inputLink(session: string, snapshotId: string, signal?: AbortSignal) {
    await this.ready(signal);
    const scan = this.scan(session, snapshotId);
    for (const [token, request] of this.inputs) {
      if (request.expiresAt < Date.now() || request.session === session) {
        this.inputs.delete(token);
      }
    }
    if (this.inputs.size >= 100) {
      throw new Error("Too many protected input requests.");
    }
    const token = randomUUID();
    this.inputs.set(token, { session, scan, expiresAt: Date.now() + 600_000 });
    return {
      path: `/api/kaki/checkout/input#${token}`,
      expiresInSeconds: 600,
      message:
        "Open this path on your authenticated Kaki dashboard origin (HTTPS or a localhost tunnel). Enter only the requested details there; do not paste identity or card data into chat. You can also enter them directly on the merchant page.",
    };
  }
  inputFields(token: string) {
    const request = this.inputs.get(token);
    if (!this.active || !request || request.expiresAt < Date.now()) {
      throw new Error("Protected input expired. Ask Kaki to inspect again.");
    }
    this.scan(request.session, request.scan.snapshotId);
    return {
      merchant: request.scan.url,
      fields: request.scan.fields.filter(
        (field) => field.sensitivity === "ordinary" || field.sensitivity === "identity",
      ),
    };
  }
  async submitInput(token: string, answers: Record<string, string>) {
    await this.ready();
    const request = this.inputs.get(token);
    const allowed = this.inputFields(token);
    if (!request) {
      throw new Error("Protected input expired.");
    }
    for (const id of Object.keys(answers)) {
      if (!allowed.fields.some((field) => field.id === id)) {
        throw new Error("Unsupported input field.");
      }
    }
    this.inputs.delete(token);
    const next = await this.browser.fill(
      request.scan.targetId,
      request.scan.profile,
      request.scan.snapshotId,
      answers,
    );
    await this.ready();
    this.saveScan(request.session, next);
    return {
      ok: true,
      message: "Details sent to the named checkout. Return to Kaki and ask it to inspect again.",
    };
  }
  private async record(session: string, id: string): Promise<CheckoutPayment> {
    const record = await this.store.lookup(paymentKey(id));
    if (!record || record.kind !== "payment" || record.session !== hash(session)) {
      throw new Error("Payment request does not belong to this conversation.");
    }
    return record;
  }
  private async current(session: string): Promise<CheckoutPayment | undefined> {
    const reference = await this.store.lookup(this.sessionKey(session));
    if (!reference) {
      return undefined;
    }
    if (reference.kind !== "session") {
      throw new Error("Checkout state requires operator repair.");
    }
    return this.record(session, reference.id);
  }
  private async reconcile(session: string, record: CheckoutPayment, signal?: AbortSignal) {
    if (terminal(record) || !record.spendId) {
      return record;
    }
    const payment = await this.link.retrieve(record.spendId);
    await this.ready(signal);
    const succeeded = payment.status === "succeeded";
    const stoppedBeforeSubmission =
      (record.stage === "pending" || record.stage === "canceling") &&
      ["denied", "expired", "failed", "canceled"].includes(payment.status);
    if (!succeeded && !stoppedBeforeSubmission) {
      return record;
    }
    await this.store.update!(paymentKey(record.id), (current) => {
      if (!current || current.kind !== "payment" || current.stage !== record.stage) {
        return current;
      }
      return {
        ...current,
        stage: "settled",
        // SAFETY: succeeded or stoppedBeforeSubmission above restricts status to these terminal outcomes.
        outcome: payment.status as CheckoutPayment["outcome"],
      };
    });
    const latest = await this.record(session, record.id);
    // Only a provider-confirmed, never-submitted failure releases the surface.
    // Successful and uncertain submissions keep their claim even in another tab.
    if (terminal(latest) && latest.outcome !== "succeeded" && stoppedBeforeSubmission) {
      await this.store.deleteIf!(
        surfaceKey(latest),
        (claim) => claim.kind === "surface" && claim.id === latest.id,
      );
    }
    return latest;
  }
  async prepare(
    session: string,
    input: {
      snapshotId: string;
      buttonId: string;
      amount: number;
      currency: string;
      summary: string;
    },
    signal?: AbortSignal,
  ) {
    await this.ready(signal);
    const old = this.scan(session, input.snapshotId);
    const scan = await this.browser.inspect(old.targetId, old.profile);
    await this.ready(signal);
    this.saveScan(session, scan);
    if (scan.pageFingerprint !== old.pageFingerprint || scan.url !== old.url) {
      throw new Error("Checkout changed. Review the current details before requesting payment.");
    }
    if (
      !Number.isSafeInteger(input.amount) ||
      input.amount <= 0 ||
      input.amount > 50_000 ||
      input.currency.toLowerCase() !== "usd"
    ) {
      throw new Error(
        "Link checkout currently supports USD purchases up to US$500 for eligible US Link accounts. Complete this payment on the merchant page.",
      );
    }
    if (
      scan.fields.some(
        (field) =>
          field.required && (!field.filled || field.invalid) && field.sensitivity !== "payment",
      )
    ) {
      throw new Error("Complete the required non-payment fields before preparing payment.");
    }
    if (scan.coverage.frames || scan.coverage.truncated || scan.coverage.customControls) {
      throw new Error(
        "This checkout uses unsupported embedded or custom controls. Complete payment directly on the merchant page.",
      );
    }
    if (new URL(scan.url).protocol !== "https:") {
      throw new Error("Use the merchant's HTTPS checkout for payment.");
    }
    const provider = await this.link.status();
    await this.ready(signal);
    if (!provider.installed || !provider.authenticated) {
      throw new Error(
        "Connect Link before preparing a payment. Use checkout status for the installation and connection steps.",
      );
    }
    const button = scan.buttons.find((candidate) => candidate.id === input.buttonId);
    if (!button) {
      throw new Error("Inspect and select the actual final purchase button.");
    }
    let previous = await this.current(session);
    if (previous) {
      previous = await this.reconcile(session, previous, signal);
    }
    if (previous && !terminal(previous)) {
      throw new Error(
        "This conversation already has a payment request. Check status or cancel it before preparing another; uncertain outcomes require merchant and Link reconciliation.",
      );
    }
    await this.ready(signal);
    const record: CheckoutPayment = {
      kind: "payment",
      id: randomUUID(),
      session: hash(session),
      targetId: scan.targetId,
      ...(scan.profile ? { profile: scan.profile } : {}),
      url: scan.url,
      pageFingerprint: scan.pageFingerprint,
      buttonId: button.id,
      buttonLabel: button.label,
      amount: input.amount,
      currency: "usd",
      summary: input.summary.slice(0, 1000),
      stage: "creating",
    };
    // Canonical records live under immutable ids. Claims contain ids only; their
    // cached stage can never become a second source of payment authority.
    await this.store.register(paymentKey(record.id), record);
    let sessionClaimed = false;
    await this.store.update!(this.sessionKey(session), (current) => {
      if (current && (current.kind !== "session" || current.id !== previous?.id)) {
        return current;
      }
      sessionClaimed = true;
      return { kind: "session", id: record.id };
    });
    if (!sessionClaimed) {
      await this.store.delete(paymentKey(record.id));
      throw new Error("This conversation already has a payment request. Check status.");
    }
    // Excluding tab id catches the same checkout opened in a second tab/session.
    // Claim before external creation; interrupted creation retains both claims.
    if (
      !(await this.store.registerIfAbsent(surfaceKey(record), { kind: "surface", id: record.id }))
    ) {
      await this.store.deleteIf!(
        this.sessionKey(session),
        (claim) => claim.kind === "session" && claim.id === record.id,
      );
      await this.store.delete(paymentKey(record.id));
      throw new Error(
        "This checkout already has a payment request in another conversation or an earlier attempt. Check its existing status; do not purchase it again.",
      );
    }
    await this.ready(signal);
    const request = await this.link.create({
      merchantName: new URL(scan.url).hostname,
      merchantUrl: scan.url,
      context: `Kaki checkout requested by the authenticated household owner. Purchase summary: ${record.summary}. The user will review merchant and total in Link before payment.`,
      amount: record.amount,
      currency: record.currency,
    });
    record.spendId = request.id;
    record.stage = "pending";
    await this.store.register(paymentKey(record.id), record);
    await this.ready(signal);
    const approval = await this.link.requestApproval(request.id);
    await this.ready(signal);
    return {
      checkoutId: record.id,
      ...approval,
      amount: record.amount,
      currency: record.currency,
      message: "Approve the exact merchant and total in Link. Payment has not been submitted.",
    };
  }
  async status(session: string, id?: string, signal?: AbortSignal) {
    await this.ready(signal);
    if (!id) {
      const record = await this.current(session);
      const provider = await this.link.status();
      await this.ready(signal);
      return {
        provider,
        ...(record
          ? {
              checkoutId: record.id,
              stage: record.stage,
              message: record.spendId
                ? "Check this checkoutId for payment status."
                : "Creation outcome is uncertain. Inspect Link activity before retrying; automatic retry is blocked.",
            }
          : {}),
      };
    }
    const record = await this.record(session, id);
    const payment = record.spendId ? await this.link.retrieve(record.spendId) : undefined;
    await this.ready(signal);
    return {
      checkoutId: id,
      stage: record.stage,
      ...(payment ? { payment } : {}),
      message:
        record.stage === "submitted" ||
        record.stage === "executing" ||
        record.outcome === "succeeded"
          ? "Do not submit again. Inspect the merchant confirmation and Link activity. Payment approval or a successful charge alone does not prove a booking exists."
          : "Payment must be approved in Link before checkout can be submitted.",
    };
  }
  async connect(signal?: AbortSignal) {
    await this.ready(signal);
    const result = await this.link.connect();
    await this.ready(signal);
    return result;
  }
  async cancel(session: string, id: string, signal?: AbortSignal) {
    await this.ready(signal);
    const record = await this.record(session, id);
    if (
      record.stage === "executing" ||
      record.stage === "submitted" ||
      !record.spendId ||
      record.outcome === "succeeded"
    ) {
      throw new Error(
        "Payment outcome requires reconciliation. Check merchant and Link activity; this action cannot undo a purchase.",
      );
    }
    if (record.stage === "canceled") {
      return { checkoutId: id, status: "canceled" };
    }
    let claimed = false;
    await this.store.update!(paymentKey(id), (current) => {
      if (!current || current.kind !== "payment" || current.stage !== "pending") {
        return current;
      }
      claimed = true;
      return { ...current, stage: "canceling" };
    });
    if (!claimed && record.stage !== "canceling") {
      throw new Error("Payment request changed. Check status.");
    }
    await this.ready(signal);
    const canceled = await this.link.cancel(record.spendId);
    if (canceled.status !== "canceled") {
      throw new Error("Link has not confirmed cancellation. Check status before retrying.");
    }
    await this.store.update!(paymentKey(id), (current) =>
      current?.kind === "payment" && current.stage === "canceling"
        ? { ...current, stage: "canceled", outcome: "canceled" }
        : current,
    );
    const latest = await this.record(session, id);
    if (latest.stage !== "canceled" && latest.outcome !== "canceled") {
      throw new Error(
        "Cancellation changed during reconciliation. Check merchant and Link activity.",
      );
    }
    await this.store.deleteIf!(
      surfaceKey(record),
      (claim) => claim.kind === "surface" && claim.id === id,
    );
    return { checkoutId: id, status: "canceled" };
  }
  async pay(session: string, id: string, signal?: AbortSignal) {
    await this.ready(signal);
    const record = await this.record(session, id);
    if (record.stage !== "pending" || !record.spendId) {
      throw new Error(
        "Payment is not pending. Check status; never repeat an uncertain submission.",
      );
    }
    const approved = await this.link.retrieve(record.spendId);
    if (
      approved.status !== "approved" ||
      approved.amount !== record.amount ||
      approved.currency?.toLowerCase() !== record.currency
    ) {
      throw new Error("Link has not approved these exact payment details. Check status.");
    }
    await this.ready(signal);
    const scan = await this.browser.inspect(record.targetId, record.profile);
    if (scan.url !== record.url || scan.pageFingerprint !== record.pageFingerprint) {
      throw new Error(
        "Checkout changed after approval. Cancel this request and review the new price and terms.",
      );
    }
    await this.ready(signal);
    let claimed = false;
    await this.store.update!(paymentKey(id), (current) => {
      if (!current || current.kind !== "payment" || current.stage !== "pending") {
        return current;
      }
      claimed = true;
      return { ...current, stage: "executing" };
    });
    if (!claimed) {
      throw new Error("Another payment attempt already owns this checkout. Check status.");
    }
    // The durable claim survives crashes, timeouts, and service restarts. Never automatically clear it.
    return this.link.consumeCredential(
      record.spendId,
      { amount: record.amount, currency: record.currency },
      async (card) => {
        await this.ready(signal);
        const filled = await this.browser.fillPayment(
          record.targetId,
          record.profile,
          scan.snapshotId,
          card,
        );
        if (
          filled.url !== record.url ||
          filled.pageFingerprint !== record.pageFingerprint ||
          !filled.buttons.some(
            (button) => button.id === record.buttonId && button.label === record.buttonLabel,
          )
        ) {
          throw new Error(
            "Checkout changed while entering payment. Submission stopped; inspect merchant and Link before recovery.",
          );
        }
        await this.ready(signal);
        await this.browser.submit(
          record.targetId,
          record.profile,
          filled.snapshotId,
          record.buttonId,
        );
        await this.store.register(paymentKey(id), { ...record, stage: "submitted" });
        return {
          checkoutId: id,
          status: "submitted_unverified",
          message:
            "Checkout was submitted once. Inspect the merchant confirmation and booking/order reference before telling the user it succeeded. Never click purchase again to resolve an uncertain outcome.",
        };
      },
    );
  }
}
