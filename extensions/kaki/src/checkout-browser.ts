import { randomUUID } from "node:crypto";

export interface CheckoutField {
  id: string;
  label: string;
  group: string;
  type: string;
  autocomplete: string;
  required: boolean;
  filled: boolean;
  invalid: boolean;
  sensitivity: "ordinary" | "identity" | "payment" | "authentication";
  options: { value: string; label: string }[];
  constraints: Record<string, string>;
}
interface PageScan {
  url: string;
  pageFingerprint: string;
  fields: CheckoutField[];
  buttons: { id: string; label: string; disabled: boolean }[];
  coverage: { truncated: boolean; frames: number; customControls: number };
}
export interface CheckoutScan extends PageScan {
  snapshotId: string;
  targetId: string;
  profile?: string;
}
export interface CheckoutCard {
  number: string;
  cvc: string;
  exp_month: number;
  exp_year: number;
  billing_address?: { name?: string };
}
export type CheckoutBrowserRequest = (
  method: string,
  params: Record<string, unknown>,
) => Promise<unknown>;

// This function runs inside the current managed page. Never return input values.
async function scanCheckoutPage(): Promise<PageScan> {
  // Method syntax preserves names without esbuild's external __name helper.
  // The serialized page function must have no references to its Node closure.
  const { clip, visible, selector, labelText } = {
    labelText(element: Element | null): string {
      if (!element) {
        return "";
      }
      if (element.matches("input,textarea,select,option")) {
        return "";
      }
      // SAFETY: DOM cloneNode preserves the node kind; its receiver is an Element.
      const clone = element.cloneNode(true) as Element;
      for (const control of clone.querySelectorAll("input,textarea,select,option,script,style")) {
        control.remove();
      }
      return clone.textContent ?? "";
    },
    clip(value: string | null | undefined) {
      return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    },
    visible(element: Element) {
      const style = getComputedStyle(element);
      return (
        Array.from(element.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0) &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    },
    selector(element: Element): string {
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.documentElement) {
        const node: Element = current;
        const siblings = Array.from(node.parentElement?.children ?? []).filter(
          (sibling) => sibling.tagName === node.tagName,
        );
        parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
        current = node.parentElement;
      }
      return `html > ${parts.join(" > ")}`;
    },
  };
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input,select,textarea",
    ),
  ).filter(
    (element) =>
      visible(element) &&
      !element.disabled &&
      !element.matches(
        '[readonly],input[type="hidden"],input[type="file"],input[type="submit"],input[type="button"],input[type="reset"]',
      ),
  );
  let truncated = controls.length > 60;
  let optionBudget = 400;
  const fields: CheckoutField[] = controls.slice(0, 60).map((element) => {
    const labelled = (element.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .map((id) => labelText(document.getElementById(id)))
      .join(" ");
    const label = clip(
      labelled ||
        element.getAttribute("aria-label") ||
        Array.from(element.labels ?? [])
          .map((item) => labelText(item))
          .join(" ") ||
        element.getAttribute("placeholder") ||
        element.name ||
        element.id ||
        element.type,
    );
    const autocomplete = clip(element.getAttribute("autocomplete")).split(" ").at(-1) ?? "";
    const hint = `${label} ${element.name} ${element.id} ${autocomplete}`;
    const sensitivity =
      element.type === "password" ||
      /one-time-code|\botp\b|verification.?code|password|security.?answer/i.test(hint)
        ? "authentication"
        : /\bcc-|card.?number|cardholder|\bcvv\b|\bcvc\b|credit.?card|debit.?card/i.test(hint)
          ? "payment"
          : /passport|national.?id|social.?security|\bssn\b|\bnric\b/i.test(hint)
            ? "identity"
            : "ordinary";
    const options =
      element instanceof HTMLSelectElement
        ? Array.from(element.options)
            .filter((option) => !option.disabled)
            .slice(0, Math.min(300, optionBudget))
            .map((option) => ({ value: clip(option.value), label: clip(option.label) }))
        : [];
    if (element instanceof HTMLSelectElement) {
      if (
        Array.from(element.options).filter((option) => !option.disabled).length > options.length
      ) {
        truncated = true;
      }
      optionBudget -= options.length;
    }
    const constraints: Record<string, string> = {};
    if (element.type === "radio" && element.name) {
      constraints.radioGroup = clip(element.name);
    }
    for (const key of ["min", "max", "minlength", "maxlength", "pattern", "step", "inputmode"]) {
      const value = element.getAttribute(key);
      if (value !== null) {
        constraints[key] = clip(value);
      }
    }
    const checked =
      element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type);
    const radioGroup =
      element instanceof HTMLInputElement && element.type === "radio" && element.name
        ? controls.filter(
            (item): item is HTMLInputElement =>
              item instanceof HTMLInputElement &&
              item.type === "radio" &&
              item.name === element.name &&
              item.form === element.form,
          )
        : [];
    return {
      id: selector(element),
      label,
      group: clip(
        labelText(element.closest("fieldset")?.querySelector("legend") ?? null) ||
          element.closest("form")?.getAttribute("aria-label"),
      ),
      type: element.type,
      autocomplete,
      required:
        element.required ||
        radioGroup.some((item) => item.required) ||
        element.getAttribute("aria-required") === "true",
      filled: radioGroup.length
        ? radioGroup.some((item) => item.checked)
        : checked
          ? element.checked
          : element.value.length > 0,
      invalid: !element.validity.valid || element.getAttribute("aria-invalid") === "true",
      sensitivity,
      options,
      constraints,
    };
  });
  // Bind the visible quote; textContent also includes hidden scripts and rotating metadata.
  // eslint-disable-next-line unicorn/prefer-dom-node-text-content
  const summary = document.body?.innerText ?? "";
  if (summary.length > 1_000_000) {
    throw new Error("checkout-page-too-large");
  }
  // Bind already-entered passenger details without returning or persisting them.
  // Payment/authentication values are excluded so trusted payment fill preserves approval.
  const privateValues = controls.slice(0, 60).flatMap((element, index) => {
    const field = fields[index];
    if (!field || field.sensitivity === "payment" || field.sensitivity === "authentication") {
      return [];
    }
    return [
      {
        id: field.id,
        value: element.value,
        checked: element instanceof HTMLInputElement ? element.checked : false,
      },
    ];
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify({ url: location.href, summary, privateValues })),
  );
  const pageFingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input[type="submit"]'),
  ).filter((element) => visible(element));
  return {
    url: `${location.origin}${location.pathname}`,
    pageFingerprint,
    fields,
    buttons: buttons.slice(0, 20).map((element) => ({
      id: selector(element),
      disabled: element.disabled,
      label: clip(
        element.getAttribute("aria-label") ||
          element.textContent ||
          (element instanceof HTMLInputElement ? element.value : ""),
      ),
    })),
    coverage: {
      truncated: truncated || buttons.length > 20,
      frames: Array.from(document.querySelectorAll("iframe,frame")).filter(visible).length,
      customControls:
        document.querySelectorAll(
          'input[type="file"],[role="textbox"],[role="combobox"],[contenteditable="true"]',
        ).length +
        Array.from(document.querySelectorAll("*")).filter((element) => element.shadowRoot !== null)
          .length,
    },
  };
}

export function createCheckoutBrowser(request: CheckoutBrowserRequest) {
  const snapshots = new Map<string, { scan: CheckoutScan; expires: number }>();
  async function evaluate(
    targetId: string,
    profile: string | undefined,
    fn: string,
  ): Promise<unknown> {
    if (!targetId.trim() || targetId.length > 256 || (profile?.length ?? 0) > 128) {
      throw new Error("checkout-invalid-target");
    }
    const response = await request("browser.request", {
      target: "host",
      method: "POST",
      path: "/act",
      ...(profile ? { query: { profile } } : {}),
      body: { kind: "evaluate", targetId, fn, timeoutMs: 15_000 },
    });
    if (!response || typeof response !== "object" || !("result" in response)) {
      throw new Error("checkout-browser-result-missing");
    }
    return response.result;
  }
  const scanner = `(${scanCheckoutPage.toString()})`;
  async function inspect(targetId: string, profile?: string): Promise<CheckoutScan> {
    const page = await evaluate(targetId, profile, `() => ${scanner}()`);
    if (
      !page ||
      typeof page !== "object" ||
      !("fields" in page) ||
      !Array.isArray(page.fields) ||
      !("url" in page) ||
      typeof page.url !== "string" ||
      !("buttons" in page) ||
      !Array.isArray(page.buttons) ||
      !("coverage" in page)
    ) {
      throw new Error("checkout-scan-invalid");
    }
    const scan = {
      // SAFETY: The owned scanCheckoutPage function produces this metadata shape; its response envelope was checked above.
      ...(page as PageScan),
      snapshotId: randomUUID(),
      targetId,
      ...(profile ? { profile } : {}),
    };
    for (const [id, entry] of snapshots) {
      if (
        entry.expires <= Date.now() ||
        (entry.scan.targetId === targetId && entry.scan.profile === profile)
      ) {
        snapshots.delete(id);
      }
    }
    if (snapshots.size >= 32) {
      snapshots.delete(snapshots.keys().next().value!);
    }
    snapshots.set(scan.snapshotId, { scan, expires: Date.now() + 10 * 60_000 });
    return scan;
  }
  function consume(
    targetId: string,
    profile: string | undefined,
    snapshotId: string,
  ): CheckoutScan {
    const entry = snapshots.get(snapshotId);
    if (
      !entry ||
      entry.expires <= Date.now() ||
      entry.scan.targetId !== targetId ||
      entry.scan.profile !== profile
    ) {
      throw new Error("checkout-snapshot-stale-rescan");
    }
    snapshots.delete(snapshotId);
    return entry.scan;
  }
  function preflight(scan: CheckoutScan) {
    const { snapshotId: _snapshot, targetId: _target, profile: _profile, ...page } = scan;
    return `const actual = await ${scanner}(); if (JSON.stringify(actual) !== ${JSON.stringify(JSON.stringify(page))}) throw new Error("checkout-page-changed-rescan");`;
  }
  async function apply(
    targetId: string,
    profile: string | undefined,
    scan: CheckoutScan,
    answers: Record<string, string>,
  ) {
    if (!Object.keys(answers).length || Object.keys(answers).length > 60) {
      throw new Error("checkout-answers-invalid");
    }
    const entries = Object.entries(answers);
    for (const [id, value] of entries) {
      const field = scan.fields.find((item) => item.id === id);
      if (
        !field ||
        typeof value !== "string" ||
        value.length > 2000 ||
        field.type === "file" ||
        (field.options.length && !field.options.some((option) => option.value === value)) ||
        (["checkbox", "radio"].includes(field.type) && !["true", "false"].includes(value))
      ) {
        throw new Error("checkout-answer-invalid");
      }
    }
    await evaluate(
      targetId,
      profile,
      `async () => { ${preflight(scan)} const entries = ${JSON.stringify(entries)}; const targets = entries.map(([id,value]) => [document.querySelector(id),value]); for (const [el,value] of targets) { if (!el || !el.isConnected || el.disabled) throw new Error("checkout-field-unavailable"); if (el.type === "checkbox" || el.type === "radio") { el.checked = value === "true"; } else { const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(el,value); } el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); } return { filled: entries.length }; }`,
    );
    return inspect(targetId, profile);
  }
  return {
    inspect,
    async fill(
      targetId: string,
      profile: string | undefined,
      snapshotId: string,
      answers: Record<string, string>,
    ) {
      const scan = consume(targetId, profile, snapshotId);
      for (const id of Object.keys(answers)) {
        const field = scan.fields.find((item) => item.id === id);
        if (!field || field.sensitivity === "payment" || field.sensitivity === "authentication") {
          throw new Error("checkout-protected-field-handoff");
        }
      }
      return apply(targetId, profile, scan, answers);
    },
    async fillPayment(
      targetId: string,
      profile: string | undefined,
      snapshotId: string,
      card: CheckoutCard,
    ) {
      const scan = consume(targetId, profile, snapshotId);
      if (scan.coverage.frames || scan.coverage.truncated || scan.coverage.customControls) {
        throw new Error("checkout-payment-coverage-handoff");
      }
      const values: Record<string, string> = {
        "cc-number": card.number,
        "cc-csc": card.cvc,
        "cc-exp-month": String(card.exp_month).padStart(2, "0"),
        "cc-exp-year": String(card.exp_year),
        "cc-exp": `${String(card.exp_month).padStart(2, "0")}/${card.exp_year}`,
        ...(card.billing_address?.name ? { "cc-name": card.billing_address.name } : {}),
      };
      const answers: Record<string, string> = {};
      if (
        scan.fields.some(
          (field) => field.autocomplete === "cc-name" && field.required && !field.filled,
        ) &&
        !card.billing_address?.name
      ) {
        throw new Error("checkout-payment-name-handoff");
      }
      for (const key of Object.keys(values)) {
        const fields = scan.fields.filter((field) => field.autocomplete === key);
        if (fields.length > 1) {
          throw new Error("checkout-payment-ambiguous-handoff");
        }
        if (fields[0]) {
          answers[fields[0].id] = values[key]!;
        }
      }
      if (
        !scan.fields.some((field) => field.autocomplete === "cc-number") ||
        !scan.fields.some((field) => field.autocomplete === "cc-csc") ||
        !(
          scan.fields.some((field) => field.autocomplete === "cc-exp") ||
          ["cc-exp-month", "cc-exp-year"].every((key) =>
            scan.fields.some((field) => field.autocomplete === key),
          )
        )
      ) {
        throw new Error("checkout-payment-fields-handoff");
      }
      return apply(targetId, profile, scan, answers);
    },
    async submit(
      targetId: string,
      profile: string | undefined,
      snapshotId: string,
      buttonId: string,
    ): Promise<{ submitted: true }> {
      const scan = consume(targetId, profile, snapshotId);
      if (
        !scan.buttons.some((button) => button.id === buttonId) ||
        scan.fields.some((field) => field.required && (!field.filled || field.invalid)) ||
        scan.coverage.frames ||
        scan.coverage.truncated ||
        scan.coverage.customControls
      ) {
        throw new Error("checkout-submit-not-ready");
      }
      await evaluate(
        targetId,
        profile,
        `async () => { ${preflight(scan)} const button = document.querySelector(${JSON.stringify(buttonId)}); if (!button || button.disabled) throw new Error("checkout-submit-unavailable"); button.click(); return {submitted:true}; }`,
      );
      return { submitted: true };
    },
  };
}
