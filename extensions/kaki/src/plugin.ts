import { createHash } from "node:crypto";
import path from "node:path";
import type { OpenClawPluginServiceContext } from "openclaw/plugin-sdk/core";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createCheckoutBrowser } from "./checkout-browser.js";
import { checkoutInputPage, createCheckoutInputHandler } from "./checkout-input.js";
import { CheckoutLinkProvider } from "./checkout-link.js";
import { KakiCheckoutOwner, type CheckoutRecord } from "./checkout-owner.js";
import { createKakiCheckoutTool } from "./checkout-tool.js";
import { createKakiControlCommands } from "./commands.js";
import { parseKakiPluginConfig, type KakiPluginConfig } from "./config.js";
import type { KakiRuntimeOwners } from "./contracts.js";
import { createKakiControlUiAssetHandler, KAKI_CONTROL_UI_PATH } from "./control-ui-assets.js";
import { createHostBackedKakiOwners } from "./host-owners.js";
import { createKakiHttpHandlers } from "./http.js";
import { registerKakiOnboardingCli } from "./onboarding-cli.js";
import { KakiRuntimeOwnerRegistry, resolveInstalledKakiRuntimeOwners } from "./owner-registry.js";
import { createKakiSkillTool } from "./skill-tool.js";

export function createKakiPlugin(
  options: {
    registry?: KakiRuntimeOwnerRegistry;
    ownerFactory?: (
      context: OpenClawPluginServiceContext,
      config: KakiPluginConfig,
    ) => KakiRuntimeOwners | Promise<KakiRuntimeOwners>;
  } = {},
) {
  return definePluginEntry({
    id: "kaki",
    name: "Kaki",
    description: "Authenticated household control routes and operator commands for Kaki.",
    register(api) {
      api.registerCli(async ({ program }) => registerKakiOnboardingCli(program, api), {
        descriptors: [
          {
            name: "kaki-bootstrap",
            description: "Provision validated encrypted Kaki onboarding state",
            hasSubcommands: true,
            machineOutput: () => true,
          },
        ],
      });
      const config = parseKakiPluginConfig(api.pluginConfig);
      let checkoutStateDir: string | undefined;
      let checkout: KakiCheckoutOwner | undefined;
      const registry = options.registry ?? new KakiRuntimeOwnerRegistry();
      if (config && (options.ownerFactory || !options.registry)) {
        const ownerFactory =
          options.ownerFactory ??
          (() =>
            createHostBackedKakiOwners(
              api.runtime,
              config,
              api.session.workflow,
              api.rootDir ? path.join(api.rootDir, "assets", "locale") : undefined,
            ));
        let release: (() => void) | undefined;
        api.registerService({
          id: "kaki-runtime-owners",
          async start(context) {
            const owners = await ownerFactory(context, config);
            checkoutStateDir = context.stateDir;
            release = registry.install({
              householdProfileId: config.householdProfileId,
              owners,
            }).release;
          },
          stop() {
            checkout?.close();
            checkout = undefined;
            checkoutStateDir = undefined;
            release?.();
            release = undefined;
          },
        });
      }
      const resolveOwners = () =>
        config
          ? (registry.current(config.householdProfileId) ??
            resolveInstalledKakiRuntimeOwners(config.householdProfileId))
          : undefined;
      const resolveCheckout = () => {
        if (!config || !checkoutStateDir || !resolveOwners()) {
          return undefined;
        }
        if (!checkout) {
          const household = createHash("sha256").update(config.householdProfileId).digest("hex");
          checkout = new KakiCheckoutOwner(
            createCheckoutBrowser((method, params) =>
              api.runtime.gateway.request(method, params, {
                timeoutMs: 30_000,
                scopes: ["operator.write"],
              }),
            ),
            new CheckoutLinkProvider({
              authFile: path.join(checkoutStateDir, "credentials", "link", household + ".json"),
            }),
            api.runtime.state.openKeyedStore<CheckoutRecord>({
              namespace: "kaki-checkout",
              maxEntries: 1000,
              overflowPolicy: "reject-new",
            }),
            async () => {
              const owners = resolveOwners();
              if (!owners || (await owners.system.snapshot(new AbortController().signal)).paused) {
                throw new Error("Kaki is paused or unavailable.");
              }
            },
          );
        }
        return checkout;
      };
      api.registerTool((context) => createKakiCheckoutTool(context, resolveCheckout), {
        name: "kaki_checkout",
      });
      api.registerHttpRoute({
        path: "/api/kaki/checkout/input",
        auth: "plugin",
        match: "exact",
        handler: checkoutInputPage,
      });
      api.registerHttpRoute({
        path: "/api/kaki/checkout/input-data",
        auth: "gateway",
        match: "exact",
        gatewayRuntimeScopeSurface: "trusted-operator",
        handler: createCheckoutInputHandler(resolveCheckout),
      });
      api.registerTool((context) => createKakiSkillTool(context, resolveOwners), {
        name: "kaki_skill",
        optional: true,
      });
      const handlers = createKakiHttpHandlers({
        resolveOwners,
        operatorPersonId: config?.operatorPersonId,
        warn: (message) => api.logger.warn?.(message),
      });
      api.registerHttpRoute({
        path: "/api/kaki/snapshot",
        auth: "gateway",
        match: "exact",
        gatewayRuntimeScopeSurface: "trusted-operator",
        handler: handlers.snapshot,
      });
      api.registerHttpRoute({
        path: "/api/kaki/action",
        auth: "gateway",
        match: "exact",
        gatewayRuntimeScopeSurface: "trusted-operator",
        handler: handlers.action,
      });
      api.registerHttpRoute({
        path: KAKI_CONTROL_UI_PATH,
        auth: "gateway",
        match: "prefix",
        gatewayRuntimeScopeSurface: "trusted-operator",
        handler: createKakiControlUiAssetHandler({ rootDir: api.rootDir }),
      });
      api.session.controls.registerControlUiDescriptor({
        surface: "tab",
        id: "kaki",
        label: "Kaki",
        description: "Household control, approvals, phone, journeys, skills, and monitors.",
        icon: "house",
        group: "control",
        order: 20,
        path: KAKI_CONTROL_UI_PATH,
        requiredScopes: ["operator.write"],
      });
      for (const controlCommand of createKakiControlCommands(
        resolveOwners,
        config?.operatorPersonId,
      )) {
        api.registerCommand(controlCommand);
      }
    },
  });
}
