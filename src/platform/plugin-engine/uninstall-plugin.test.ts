import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const listExtensionStates = vi.fn();
const invalidateExtensionStateCaches = vi.fn();
vi.mock("@/contexts/extensions", () => ({
  listExtensionStates: (...args: unknown[]) => listExtensionStates(...args),
  invalidateExtensionStateCaches: (...args: unknown[]) => invalidateExtensionStateCaches(...args),
}));

const invalidateCache = vi.fn();
vi.mock("@/infrastructure/cache/memory-cache", () => ({
  invalidateCache: (...args: unknown[]) => invalidateCache(...args),
}));

const recordAuditEvent = vi.fn();
vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const registerPlugins = vi.fn();
vi.mock("./register-plugins", () => ({
  registerPlugins: (...args: unknown[]) => registerPlugins(...args),
  PLUGIN_ENGINE_REPORT_CACHE_KEY: "plugin-engine:report",
}));

vi.mock("./run-plugin-migrations", () => ({
  resolveMigrationsSchema: (key: string, declared: string | undefined) =>
    declared ?? `${key.replace(/-/g, "_")}_migrations`,
}));

const transaction = vi.fn();
const txExecute = vi.fn();
vi.mock("@/infrastructure/database/client", () => ({
  db: { transaction: (...args: unknown[]) => transaction(...args) },
}));

vi.mock("@/plugins/registry", () => ({
  PLUGIN_REGISTRY: [
    {
      key: "enrollment-dashboard",
      name: "Dashboard de Matrícula",
      migrationsPath: "./migrations",
      migrationsSchema: "enrollment_dashboard_migrations",
    },
    { key: "donations", name: "Doações" },
  ],
}));

function activeReport(entries: unknown[] = []) {
  return { entries, permissions: [], navigation: [], routes: [], contentTypes: [], blocks: [] };
}

describe("uninstallPlugin / performPluginUninstall", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    listExtensionStates.mockReset();
    invalidateExtensionStateCaches.mockReset();
    invalidateCache.mockReset();
    recordAuditEvent.mockReset();
    registerPlugins.mockReset();
    transaction.mockReset();
    txExecute.mockReset();

    authorizeActor.mockResolvedValue({ authorized: true, actorId: "actor-1" });
    listExtensionStates.mockResolvedValue({
      success: true,
      data: { "enrollment-dashboard": { installed: true, enabled: true } },
    });
    registerPlugins.mockResolvedValue(activeReport());
    txExecute.mockResolvedValue({ rowCount: 3 });
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({ execute: txExecute }));
  });

  it("rejects an actor without platform.extensions.manage before touching the database", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { uninstallPlugin } = await import("./uninstall-plugin");
    const result = await uninstallPlugin({ pluginKey: "enrollment-dashboard", purgeData: true });

    expect(result).toEqual({ success: false, error: { code: "rbac.authorization.forbidden", message: "sem permission" } });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a plugin key that is not in the registry", async () => {
    const { performPluginUninstall } = await import("./uninstall-plugin");
    const result = await performPluginUninstall({ pluginKey: "ghost", purgeData: true, actorId: "actor-1" });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: { code: "plugin-engine.uninstall.unknown_plugin" } });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects when the plugin is not installed", async () => {
    listExtensionStates.mockResolvedValue({ success: true, data: {} });

    const { performPluginUninstall } = await import("./uninstall-plugin");
    const result = await performPluginUninstall({ pluginKey: "enrollment-dashboard", purgeData: true, actorId: "actor-1" });

    expect(result).toMatchObject({ error: { code: "plugin-engine.uninstall.not_installed" } });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("blocks uninstall while an enabled plugin still requires it, naming the dependent", async () => {
    registerPlugins.mockResolvedValue(
      activeReport([
        {
          key: "party",
          status: "active",
          manifest: {
            key: "party",
            name: "Festa",
            dependencies: [{ pluginKey: "enrollment-dashboard", type: "required" }],
          },
          errors: [],
        },
      ]),
    );

    const { performPluginUninstall } = await import("./uninstall-plugin");
    const result = await performPluginUninstall({ pluginKey: "enrollment-dashboard", purgeData: true, actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: {
        code: "plugin-engine.uninstall.blocked_by_dependents",
        message: expect.stringContaining("Festa"),
      },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("drops the schemas, purges the namespace, invalidates caches and audits on success", async () => {
    const { performPluginUninstall } = await import("./uninstall-plugin");
    const result = await performPluginUninstall({ pluginKey: "enrollment-dashboard", purgeData: true, actorId: "actor-1" });

    expect(result).toEqual({ success: true, data: undefined });

    // 2 DROP SCHEMA (dado + tracking) + DELETE settings + DELETE role_permissions + UPDATE extension_state.
    expect(txExecute).toHaveBeenCalledTimes(5);

    expect(invalidateExtensionStateCaches).toHaveBeenCalledWith("plugin", "enrollment-dashboard");
    expect(invalidateCache).toHaveBeenCalledWith("plugin-engine:report");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "plugin-engine.uninstall-plugin",
        outcome: "success",
        detail: expect.objectContaining({
          pluginKey: "enrollment-dashboard",
          dataSchema: "enrollment_dashboard",
          settingsDeleted: 3,
          permissionsDeleted: 3,
        }),
      }),
    );
  });

  it("returns a failure result and audits it when the transaction throws", async () => {
    transaction.mockRejectedValue(new Error("connection reset"));

    const { performPluginUninstall } = await import("./uninstall-plugin");
    const result = await performPluginUninstall({ pluginKey: "enrollment-dashboard", purgeData: true, actorId: "actor-1" });

    expect(result).toMatchObject({ error: { code: "plugin-engine.uninstall.failed" } });
    expect(result.success).toBe(false);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "plugin-engine.uninstall-plugin", outcome: "failure" }),
    );
    expect(invalidateCache).not.toHaveBeenCalled();
  });

  it("skips the schema drop for a settings-only plugin but still purges the namespace", async () => {
    listExtensionStates.mockResolvedValue({ success: true, data: { donations: { installed: true, enabled: true } } });

    const { performPluginUninstall } = await import("./uninstall-plugin");
    const result = await performPluginUninstall({ pluginKey: "donations", purgeData: true, actorId: "actor-1" });

    expect(result).toEqual({ success: true, data: undefined });
    // Sem DROP SCHEMA: só DELETE settings + DELETE role_permissions + UPDATE extension_state.
    expect(txExecute).toHaveBeenCalledTimes(3);
  });

  it("preserves the schema and namespace when purgeData is false, only resetting extension_state", async () => {
    const { performPluginUninstall } = await import("./uninstall-plugin");
    const result = await performPluginUninstall({
      pluginKey: "enrollment-dashboard",
      purgeData: false,
      actorId: "actor-1",
    });

    expect(result).toEqual({ success: true, data: undefined });

    // Nenhum DROP SCHEMA, nenhum DELETE: só o UPDATE em extensions.extension_state.
    expect(txExecute).toHaveBeenCalledTimes(1);

    expect(invalidateExtensionStateCaches).toHaveBeenCalledWith("plugin", "enrollment-dashboard");
    expect(invalidateCache).toHaveBeenCalledWith("plugin-engine:report");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "plugin-engine.uninstall-plugin",
        outcome: "success",
        detail: expect.objectContaining({
          pluginKey: "enrollment-dashboard",
          purgeData: false,
          settingsDeleted: 0,
          permissionsDeleted: 0,
        }),
      }),
    );
  });
});
