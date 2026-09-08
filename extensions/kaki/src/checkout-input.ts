import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isRecord } from "openclaw/plugin-sdk/string-coerce-runtime";
import {
  applyBasicWebhookRequestGuards,
  readJsonWebhookBodyOrReject,
} from "openclaw/plugin-sdk/webhook-request-guards";
import type { KakiCheckoutOwner } from "./checkout-owner.js";

const INPUT_PATH = "/api/kaki/checkout/input-data";
function json(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(value));
}
// This static shell is public; field metadata and submission use the gateway-authenticated data route.
export async function checkoutInputPage(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (_req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return true;
  }
  const nonce = randomBytes(24).toString("base64");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  );
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Kaki · Checkout details</title>
<style nonce="${nonce}">body{font:17px system-ui;background:#f4f6f3;color:#17372d;margin:0}main{max-width:560px;margin:6vh auto;padding:28px;background:white;border-radius:20px}label{display:block;margin:18px 0 6px}input,select,textarea,button{box-sizing:border-box;width:100%;padding:12px;font:inherit}input[type=checkbox],input[type=radio]{width:auto;margin:0 8px 0 0;vertical-align:middle}button{margin-top:22px;background:#17372d;color:white;border:0;border-radius:8px}small{display:block;color:#4f635b}#message{white-space:pre-wrap}</style>
<main><h1>Checkout details</h1><p>Enter only the information required by your booking page. It goes directly to that checkout through Kaki, outside your chat history.</p>
<form id="unlock"><label for="gateway">Kaki dashboard access token</label><input id="gateway" type="password" autocomplete="off" required><small>Use your private dashboard token. It stays in this page's memory.</small><button>Load requested fields</button></form>
<form id="details" hidden><p id="merchant"></p><div id="fields"></div><label><input id="consent" type="checkbox" required> I authorize sending these details to the checkout shown above.</label><button>Send details to checkout</button></form><p role="status" id="message"></p></main>
<script nonce="${nonce}">
const token=location.hash.slice(1);history.replaceState(null,"",location.pathname);let gateway="",fields=[];
const message=document.querySelector("#message"),details=document.querySelector("#details");
async function call(body){const response=await fetch("${INPUT_PATH}",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+gateway,"X-Kaki-Intent":"checkout-input"},body:JSON.stringify({...body,token})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to complete input.");return data;}
if(!isSecureContext){document.querySelector("#unlock").hidden=true;message.textContent="Use HTTPS or a localhost tunnel to open this form.";}
document.querySelector("#unlock").onsubmit=async(event)=>{event.preventDefault();gateway=document.querySelector("#gateway").value;message.textContent="Loading…";try{const data=await call({action:"fields"});fields=data.fields;document.querySelector("#merchant").textContent="Send to: "+data.merchant;const container=document.querySelector("#fields");container.replaceChildren();for(const [index,field]of fields.entries()){if(field.filled&&!field.invalid)continue;const label=document.createElement("label");label.textContent=(field.group?field.group+" · ":"")+field.label+(field.required?" (required)":" (optional)");const input=document.createElement(field.options.length?"select":field.type==="textarea"?"textarea":"input");input.id="field-"+index;label.htmlFor=input.id;input.dataset.field=field.id;if(field.options.length){const empty=document.createElement("option");empty.value="";empty.textContent="Choose…";input.append(empty);for(const option of field.options){const entry=document.createElement("option");entry.value=option.value;entry.textContent=option.label;input.append(entry);}}else{input.type=["email","tel","date","number","checkbox","radio"].includes(field.type)?field.type:"text";if(field.type==="radio")input.name=field.constraints.radioGroup||field.group||field.label;}input.required=field.required;input.autocomplete="off";for(const [key,value]of Object.entries(field.constraints)){if(["min","max","minlength","maxlength","step"].includes(key))input.setAttribute(key,value);}if(["checkbox","radio"].includes(input.type)){label.prepend(input);container.append(label);}else{container.append(label,input);}}document.querySelector("#gateway").value="";document.querySelector("#unlock").hidden=true;details.hidden=false;message.textContent="";}catch(error){message.textContent=error.message;}};
details.onsubmit=async(event)=>{event.preventDefault();if(!document.querySelector("#consent").checked)return;const answers={};for(const input of document.querySelectorAll("[data-field]")){if(["checkbox","radio"].includes(input.type)){if(input.checked)answers[input.dataset.field]="true";}else if(input.value)answers[input.dataset.field]=input.value;}const button=details.querySelector("button");button.disabled=true;try{const data=await call({action:"submit",answers,consent:true});details.replaceChildren();gateway="";message.textContent=data.message;}catch(error){message.textContent=error.message+" Ask Kaki to inspect again before retrying.";details.replaceChildren();gateway="";}};
</script></html>`);
  return true;
}
export function createCheckoutInputHandler(resolve: () => KakiCheckoutOwner | undefined) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (
      !applyBasicWebhookRequestGuards({
        req,
        res,
        allowMethods: ["POST"],
        requireJsonContentType: true,
      })
    ) {
      return true;
    }
    if (req.headers["x-kaki-intent"] !== "checkout-input") {
      json(res, 400, { error: "Missing checkout intent." });
      return true;
    }
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          json(res, 403, { error: "Origin mismatch." });
          return true;
        }
      } catch {
        json(res, 403, { error: "Invalid origin." });
        return true;
      }
    }
    const body = await readJsonWebhookBodyOrReject({
      req,
      res,
      maxBytes: 130_000,
      timeoutMs: 5000,
      invalidJsonMessage: "Invalid checkout input.",
    });
    if (!body.ok) {
      return true;
    }
    const raw = body.value;
    if (!isRecord(raw) || typeof raw.token !== "string" || raw.token.length > 128) {
      json(res, 400, { error: "Invalid input request." });
      return true;
    }
    const owner = resolve();
    if (!owner) {
      json(res, 503, { error: "Checkout service is unavailable." });
      return true;
    }
    try {
      if (raw.action === "fields") {
        json(res, 200, owner.inputFields(raw.token));
        return true;
      }
      if (
        raw.action !== "submit" ||
        raw.consent !== true ||
        !isRecord(raw.answers) ||
        Object.keys(raw.answers).length > 60 ||
        !Object.values(raw.answers).every((v) => typeof v === "string" && v.length <= 2000)
      ) {
        json(res, 400, { error: "Complete the form and approve its destination." });
        return true;
      }
      // SAFETY: The preceding guard verifies an own-value record with every answer a bounded string.
      json(res, 200, await owner.submitInput(raw.token, raw.answers as Record<string, string>));
    } catch {
      // Never reflect browser errors: sites may include entered identity values in them.
      json(res, 409, {
        error:
          "Input expired, the checkout changed, or a field could not be filled. Ask Kaki to inspect again.",
      });
    }
    return true;
  };
}
