import { validateJsonSchemaValue } from "openclaw/plugin-sdk/json-schema-runtime";
import type { AnyAgentTool, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { describe, expect, it, vi } from "vitest";
import manifest from "./openclaw.plugin.json" with { type: "json" };
import { KAKI_CONTROL_COMMANDS } from "./src/commands.js";
import { KakiRuntimeOwnerRegistry } from "./src/owner-registry.js";
import { createKakiPlugin } from "./src/plugin.js";
import { createTestOwners, validPluginConfig } from "./src/test-support.js";

function registerPlugin(runtime?: unknown) {
  const registry = new KakiRuntimeOwnerRegistry();
  if (!runtime) {
    registry.install({
      householdProfileId: "household-1",
      owners: createTestOwners(),
    });
  }
  const routes: Array<Record<string, unknown>> = [];
  const commands: Array<Record<string, unknown>> = [];
  const services: Array<Record<string, unknown>> = [];
  const cli: Array<Record<string, unknown>> = [];
  const tools: Array<Record<string, unknown>> = [];
  const toolFactories: Array<(context: OpenClawPluginToolContext) => AnyAgentTool | null> = [];
  const controls: Array<Record<string, unknown>> = [];
  createKakiPlugin({
    registry,
    ...(runtime ? { ownerFactory: () => createTestOwners() } : {}),
  }).register({
    runtime,
    pluginConfig: validPluginConfig,
    logger: { warn: vi.fn() },
    registerHttpRoute(route: unknown) {
      routes.push(route as unknown as Record<string, unknown>);
    },
    registerCommand(command: unknown) {
      commands.push(command as unknown as Record<string, unknown>);
    },
    registerService(service: unknown) {
      services.push(service as unknown as Record<string, unknown>);
    },
    registerCli(_registrar: unknown, options: unknown) {
      cli.push(options as unknown as Record<string, unknown>);
    },
    registerTool(factory: unknown, options: unknown) {
      toolFactories.push(factory as (context: OpenClawPluginToolContext) => AnyAgentTool | null);
      tools.push(options as unknown as Record<string, unknown>);
    },
    session: {
      controls: {
        registerControlUiDescriptor(descriptor: unknown) {
          controls.push(descriptor as unknown as Record<string, unknown>);
        },
      },
    },
  } as never);
  return { routes, commands, services, cli, tools, toolFactories, controls };
}

describe("Kaki plugin entry", () => {
  it("is opt-in and requires the complete non-secret onboarding reference contract", () => {
    expect(manifest.enabledByDefault).toBe(false);
    expect(manifest.activation.onStartup).toBe(false);
    expect(manifest.activation.onConfigPaths).toEqual(["plugins.entries.kaki"]);
    expect(manifest.contracts.tools).toEqual(["kaki_skill", "kaki_checkout"]);
    expect(manifest.configSchema.additionalProperties).toBe(false);
    const fullConfigBranch = manifest.configSchema.oneOf.find(
      (branch): branch is { required: string[] } => "required" in branch,
    );
    expect(new Set(fullConfigBranch?.required)).toEqual(
      new Set([
        "householdProfileId",
        "operatorPersonId",
        "addressBookProfileId",
        "approvalPolicyProfileId",
        "dataProfileId",
        "phoneNodeId",
        "whatsappAccountId",
        "telegramAccountId",
        "modelProfileId",
        "asrProfileId",
        "locale",
      ]),
    );
    expect(
      validateJsonSchemaValue({
        schema: manifest.configSchema,
        value: {},
        cacheKey: "kaki.bootstrap-config",
      }).ok,
    ).toBe(true);
    expect(
      validateJsonSchemaValue({
        schema: manifest.configSchema,
        value: { householdProfileId: "partial" },
        cacheKey: "kaki.partial-config",
      }).ok,
    ).toBe(false);
    expect(
      validateJsonSchemaValue({
        schema: manifest.configSchema,
        value: validPluginConfig,
        cacheKey: "kaki.complete-config",
      }).ok,
    ).toBe(true);
  });

  it("registers exact Gateway-authenticated control routes", () => {
    const { routes, services, cli, tools, controls } = registerPlugin();
    expect(services).toEqual([]);
    expect(routes).toHaveLength(5);
    expect(
      routes.map(({ path, auth, match, gatewayRuntimeScopeSurface }) => ({
        path,
        auth,
        match,
        gatewayRuntimeScopeSurface,
      })),
    ).toEqual([
      {
        path: "/api/kaki/checkout/input",
        auth: "plugin",
        match: "exact",
        gatewayRuntimeScopeSurface: undefined,
      },
      {
        path: "/api/kaki/checkout/input-data",
        auth: "gateway",
        match: "exact",
        gatewayRuntimeScopeSurface: "trusted-operator",
      },
      {
        path: "/api/kaki/snapshot",
        auth: "gateway",
        match: "exact",
        gatewayRuntimeScopeSurface: "trusted-operator",
      },
      {
        path: "/api/kaki/action",
        auth: "gateway",
        match: "exact",
        gatewayRuntimeScopeSurface: "trusted-operator",
      },
      {
        path: "/plugins/kaki/control",
        auth: "gateway",
        match: "prefix",
        gatewayRuntimeScopeSurface: "trusted-operator",
      },
    ]);
    expect(cli[0]?.descriptors).toEqual([
      expect.objectContaining({ name: "kaki-bootstrap", machineOutput: expect.any(Function) }),
    ]);
    expect(tools).toEqual([
      expect.objectContaining({ name: "kaki_checkout" }),
      expect.objectContaining({ name: "kaki_skill", optional: true }),
    ]);
    expect(controls).toEqual([
      expect.objectContaining({
        id: "kaki",
        path: "/plugins/kaki/control",
        requiredScopes: ["operator.write"],
      }),
    ]);
  });

  it("uses the gateway browser admin contract after owner and service checks", async () => {
    const request = vi.fn(async (_method, _params, options) => {
      if (!options.scopes.includes("operator.admin")) {
        throw new Error("missing scope: operator.admin");
      }
      return {
        result: {
          url: "https://merchant.example/checkout",
          pageFingerprint: "quote",
          fields: [],
          buttons: [],
          coverage: { frames: 0, customControls: 0, truncated: false },
        },
      };
    });
    const { services, toolFactories } = registerPlugin({
      gateway: { request },
      state: { openKeyedStore: () => ({ update: vi.fn(), deleteIf: vi.fn() }) },
    });
    const context = { sessionKey: "owner-session", senderIsOwner: true };
    const tool = toolFactories[0]!(context);
    if (!tool) {
      throw new Error("Expected owner checkout tool");
    }
    await expect(
      tool.execute("not-started", { action: "inspect", targetId: "tab" }),
    ).rejects.toThrow("unavailable");
    expect(toolFactories[0]!({ sessionKey: "guest", senderIsOwner: false })).toBeNull();
    expect(request).not.toHaveBeenCalled();
    const service = services[0] as { start: (context: unknown) => Promise<void>; stop: () => void };
    await service.start({ stateDir: "/tmp/kaki-checkout-test" });
    const result = await tool.execute("scan", { action: "inspect", targetId: "tab" });
    expect(result.details.url).toBe("https://merchant.example/checkout");
    expect(request).toHaveBeenCalledWith(
      "browser.request",
      expect.objectContaining({ method: "POST", path: "/act" }),
      expect.objectContaining({ scopes: ["operator.admin"] }),
    );
    service.stop();
  });

  it("enumerates every required control command without shadowing host status or approvals", () => {
    expect(KAKI_CONTROL_COMMANDS.map((entry) => entry.invocation)).toEqual([
      "/status",
      "/approve",
      "/deny",
      "/relink-wa",
      "/journey",
      "/household",
      "/phone",
      "/skills",
      "/cron",
      "/locale",
      "/pause",
      "/resume",
      "/cost",
    ]);
    const { commands } = registerPlugin();
    expect(commands.map((entry) => entry.name)).toEqual(
      KAKI_CONTROL_COMMANDS.filter((entry) => entry.owner === "kaki").map((entry) =>
        entry.invocation.slice(1),
      ),
    );
    expect(commands.every((entry) => entry.requireAuth === true)).toBe(true);
    expect(commands.every((entry) => entry.exposeSenderIsOwner === true)).toBe(true);
    expect(commands.every((entry) => JSON.stringify(entry.channels) === '["telegram"]')).toBe(true);
  });
});
