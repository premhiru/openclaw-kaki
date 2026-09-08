import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export const CHECKOUT_LINK_VERSION = "0.17.3";
const INSTALL_COMMAND = `npm install --global @stripe/link-cli@${CHECKOUT_LINK_VERSION}`;
const STATUSES = [
  "created",
  "pending_approval",
  "approved",
  "denied",
  "expired",
  "canceled",
  "succeeded",
  "failed",
  "requires_action",
] as const;
type LinkStatus = (typeof STATUSES)[number];
export type LinkSpendSnapshot = {
  id: string;
  status: LinkStatus;
  amount?: number;
  currency?: string;
  approvalUrl?: string;
  action?: { type: string; resolution: string; url?: string };
};
export type LinkCheckoutCard = {
  number: string;
  cvc: string;
  exp_month: number;
  exp_year: number;
  billing_address?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
};
export type LinkCheckoutPurchase = {
  merchantName: string;
  merchantUrl: string;
  context: string;
  amount: number;
  currency: string;
  test?: boolean;
};

function invalid(): never {
  throw new Error("link-invalid-response: Check payment status before retrying.");
}

// The CLI emits a JSON array for generators, or complete successive JSON values.
// Parse strictly: silently skipping malformed output could approve an older event.
function lastRecord(output: string): Record<string, unknown> {
  const values: unknown[] = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < output.length; i++) {
    const ch = output[i]!;
    if (start < 0) {
      if (/\s/.test(ch)) {
        continue;
      }
      if (ch !== "{" && ch !== "[") {
        invalid();
      }
      start = i;
    }
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        quoted = false;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === "{" || ch === "[") {
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(output.slice(start, i + 1));
          if (Array.isArray(parsed)) {
            values.push(...parsed);
          } else {
            values.push(parsed);
          }
        } catch {
          invalid();
        }
        start = -1;
      }
    }
  }
  if (start >= 0) {
    invalid();
  }
  const record = values.at(-1);
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    invalid();
  }
  // SAFETY: JSON parsing and the preceding guard establish a non-null, non-array object.
  return record as Record<string, unknown>;
}

function linkUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "link.com" || url.hostname.endsWith(".link.com"))
    ) {
      return url.href;
    }
  } catch {
    /* Invalid upstream URLs are never sent to the user. */
  }
  return undefined;
}
function spendId(id: string): string {
  if (!/^lsrq_[A-Za-z0-9]+$/.test(id)) {
    throw new Error("link-invalid-request-id");
  }
  return id;
}
function snapshot(raw: Record<string, unknown>): LinkSpendSnapshot {
  if (typeof raw.id !== "string" || !STATUSES.some((status) => status === raw.status)) {
    invalid();
  }
  // SAFETY: The preceding membership check restricts status to the closed Link status set.
  const result: LinkSpendSnapshot = { id: spendId(raw.id), status: raw.status as LinkStatus };
  if (typeof raw.amount === "number" && Number.isSafeInteger(raw.amount)) {
    result.amount = raw.amount;
  }
  if (typeof raw.currency === "string" && /^[a-z]{3}$/.test(raw.currency)) {
    result.currency = raw.currency;
  }
  const approvalUrl = linkUrl(raw.approval_url);
  if (approvalUrl) {
    result.approvalUrl = approvalUrl;
  }
  // Keep the status-details projection bounded, and never copy provider prose or secrets.
  // SAFETY: Parsed JSON is inert; optional access and primitive checks below validate every projected member.
  const details = raw.status_details as
    | {
        requires_action?: {
          next_action?: { type?: unknown; resolution?: unknown; action_url?: unknown };
        };
      }
    | undefined;
  const action = details?.requires_action?.next_action;
  if (
    action &&
    typeof action.type === "string" &&
    /^[a-z_]{1,64}$/.test(action.type) &&
    typeof action.resolution === "string" &&
    /^[a-z_]{1,64}$/.test(action.resolution)
  ) {
    result.action = {
      type: action.type,
      resolution: action.resolution,
      url: linkUrl(action.action_url),
    };
  }
  return result;
}

export class CheckoutLinkProvider {
  private versionCheck?: Promise<boolean>;
  constructor(private readonly options: { authFile: string; executable?: string }) {
    if (!path.isAbsolute(options.authFile)) {
      throw new Error("link-auth-path-must-be-absolute");
    }
  }

  private async execute(args: string[]): Promise<string> {
    // Inherited LINK_ACCESS_TOKEN or endpoint overrides would defeat household isolation.
    const env: NodeJS.ProcessEnv = { NO_UPDATE_NOTIFIER: "1", DO_NOT_TRACK: "1" };
    for (const key of ["PATH", "HOME", "USERPROFILE", "SystemRoot", "TEMP", "TMP", "TMPDIR"]) {
      if (process.env[key]) {
        env[key] = process.env[key];
      }
    }
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(
          this.options.executable ?? "link-cli",
          args,
          {
            shell: false,
            windowsHide: true,
            timeout: 30_000,
            maxBuffer: 1_048_576,
            env,
          },
          (error, output) => (error ? reject(error) : resolve(output)),
        );
      });
      return stdout;
    } catch {
      // execFile errors contain stdout, stderr, argv and potentially credentials.
      throw new Error(
        "link-command-failed: Check Link status before retrying; no payment outcome is implied.",
      );
    }
  }
  private installed(): Promise<boolean> {
    return (this.versionCheck ??= this.execute(["--version"]).then(
      (version) => version.trim() === CHECKOUT_LINK_VERSION,
      () => false,
    ));
  }
  private async command(args: string[]): Promise<Record<string, unknown>> {
    if (!(await this.installed())) {
      throw new Error(`link-cli-unavailable: Install ${INSTALL_COMMAND} and restart Kaki.`);
    }
    return lastRecord(
      await this.execute([...args, "--auth", this.options.authFile, "--format", "json"]),
    );
  }
  async status() {
    const installed = await this.installed();
    const limits = {
      accountCountry: "US",
      currency: "usd",
      maxAmount: 50_000,
      approvalRequired: true,
    } as const;
    if (!installed) {
      return {
        installed,
        authenticated: false,
        version: CHECKOUT_LINK_VERSION,
        installCommand: INSTALL_COMMAND,
        limits,
      };
    }
    const auth = await this.command(["auth", "status"]);
    return {
      installed,
      authenticated: auth.authenticated === true,
      pending: auth.pending === true,
      verificationUrl: linkUrl(auth.verification_url),
      version: CHECKOUT_LINK_VERSION,
      limits,
    };
  }
  async connect() {
    await mkdir(path.dirname(this.options.authFile), { recursive: true, mode: 0o700 });
    const auth = await this.command(["auth", "login", "--client-name", "Kaki"]);
    return {
      authenticated: auth.authenticated === true,
      verificationUrl: linkUrl(auth.verification_url),
      phrase:
        typeof auth.phrase === "string" && /^[a-zA-Z0-9 -]{1,120}$/.test(auth.phrase)
          ? auth.phrase
          : undefined,
    };
  }
  async create(purchase: LinkCheckoutPurchase): Promise<LinkSpendSnapshot> {
    // US availability does not prove support for arbitrary currency exponents or limits.
    if (
      purchase.currency.toLowerCase() !== "usd" ||
      !Number.isSafeInteger(purchase.amount) ||
      purchase.amount <= 0 ||
      purchase.amount > 50_000
    ) {
      throw new Error(
        "link-unsupported-amount: Kaki supports USD purchases up to $500; use manual checkout for other amounts or currencies.",
      );
    }
    let merchant: URL;
    try {
      merchant = new URL(purchase.merchantUrl);
    } catch {
      throw new Error("link-invalid-merchant");
    }
    if (
      merchant.protocol !== "https:" ||
      merchant.username ||
      merchant.password ||
      !purchase.merchantName.trim() ||
      purchase.merchantName.length > 200 ||
      purchase.context.length < 100 ||
      purchase.context.length > 4000
    ) {
      throw new Error(
        "link-invalid-purchase: Supply a verified merchant and a complete purchase summary.",
      );
    }
    const args = [
      "spend-request",
      "create",
      "--no-request-approval",
      "--merchant-name",
      purchase.merchantName,
      "--merchant-url",
      merchant.href,
      "--context",
      purchase.context,
      "--amount",
      String(purchase.amount),
      "--currency",
      "usd",
    ];
    if (purchase.test) {
      args.push("--test");
    }
    return snapshot(await this.command(args));
  }
  async requestApproval(id: string): Promise<{ id: string; approvalUrl: string }> {
    const raw = await this.command(["spend-request", "request-approval", spendId(id)]);
    const approvalUrl = linkUrl(raw.approval_url);
    if (raw.id !== id || !approvalUrl) {
      invalid();
    }
    return { id, approvalUrl };
  }
  async retrieve(id: string): Promise<LinkSpendSnapshot> {
    const result = snapshot(await this.command(["spend-request", "retrieve", spendId(id)]));
    if (result.id !== id) {
      invalid();
    }
    return result;
  }
  async cancel(id: string): Promise<LinkSpendSnapshot> {
    const result = snapshot(await this.command(["spend-request", "cancel", spendId(id)]));
    if (result.id !== id) {
      invalid();
    }
    return result;
  }
  async consumeCredential<T>(
    id: string,
    expected: Pick<LinkCheckoutPurchase, "amount" | "currency">,
    consume: (card: LinkCheckoutCard) => Promise<T>,
  ): Promise<T> {
    const matches = (payment: LinkSpendSnapshot) =>
      payment.status === "approved" &&
      payment.amount === expected.amount &&
      payment.currency === expected.currency.toLowerCase();
    if (!matches(await this.retrieve(id))) {
      throw new Error("link-payment-not-approved");
    }
    const raw = await this.command(["spend-request", "retrieve", spendId(id), "--include", "card"]);
    const payment = snapshot(raw);
    // Bind the credentials themselves to the approved facts, not an earlier poll.
    // Link approvals can change while browser preparation is in flight.
    if (payment.id !== id || !matches(payment)) {
      throw new Error("link-payment-not-approved");
    }
    // SAFETY: The immediately following guard validates payment fields before the private callback can consume them.
    const card = raw.card as LinkCheckoutCard | undefined;
    if (
      !card ||
      typeof card.number !== "string" ||
      !/^\d{12,19}$/.test(card.number) ||
      typeof card.cvc !== "string" ||
      !/^\d{3,4}$/.test(card.cvc) ||
      !Number.isInteger(card.exp_month) ||
      card.exp_month < 1 ||
      card.exp_month > 12 ||
      !Number.isInteger(card.exp_year)
    ) {
      invalid();
    }
    try {
      return await consume(card);
    } catch {
      throw new Error("link-checkout-unconfirmed: Verify the merchant booking before any retry.");
    } finally {
      // No credential files or logs. Remove retained references after bridge execution.
      card.number = "";
      card.cvc = "";
      delete raw.card;
    }
  }
}
