import { beforeEach, describe, expect, it, vi } from "vitest";

const listExtensionStates = vi.fn();
const setExtensionInstalled = vi.fn();

vi.mock("@/contexts/extensions", () => ({
  listExtensionStates: (...args: unknown[]) => listExtensionStates(...args),
  setExtensionInstalled: (...args: unknown[]) => setExtensionInstalled(...args),
}));

const grantPermissionsToRole = vi.fn();

vi.mock("@/contexts/rbac", () => ({
  grantPermissionsToRole: (...args: unknown[]) => grantPermissionsToRole(...args),
}));

const runPluginMigrations = vi.fn();

vi.mock("./run-plugin-migrations", () => ({
  runPluginMigrations: (...args: unknown[]) => runPluginMigrations(...args),
}));

vi.mock("@/plugins/registry", () => ({
  PLUGIN_REGISTRY: [
    {
      key: "broadcast",
      name: "Broadcast",
      version: "1.0.0",
      migrationsPath: "./migrations",
      permissions: [{ key: "broadcast.manage", label: "Manage broadcast" }],
    },
    { key: "donations", name: "Doações", version: "1.0.0" },
  ],
}));

describe("installPlugin", () => {
  beforeEach(() => {
    listExtensionStates.mockReset();
    setExtensionInstalled.mockReset();
    grantPermissionsToRole.mockReset();
    runPluginMigrations.mockReset();
    listExtensionStates.mockResolvedValue({ success: true, data: {} });
    setExtensionInstalled.mockResolvedValue({ success: true, data: {} });
    grantPermissionsToRole.mockResolvedValue({ success: true, data: { grantedCount: 1 } });
    runPluginMigrations.mockResolvedValue({ success: true, data: { pluginKey: "broadcast" } });
  });

  it("rejects a plugin key that is not in the registry", async () => {
    const { installPlugin } = await import("./install-plugin");
    const result = await installPlugin({ pluginKey: "ghost" });

    expect(result).toEqual({
      success: false,
      error: { code: "plugin-engine.install.unknown_plugin", message: expect.any(String) },
    });
    expect(runPluginMigrations).not.toHaveBeenCalled();
    expect(setExtensionInstalled).not.toHaveBeenCalled();
    expect(grantPermissionsToRole).not.toHaveBeenCalled();
  });

  it("skips migrations and the state write when already installed, but still re-asserts the admin grant", async () => {
    listExtensionStates.mockResolvedValue({ success: true, data: { broadcast: { installed: true, enabled: true } } });

    const { installPlugin } = await import("./install-plugin");
    const result = await installPlugin({ pluginKey: "broadcast" });

    expect(result).toEqual({ success: true, data: undefined });
    expect(runPluginMigrations).not.toHaveBeenCalled();
    expect(setExtensionInstalled).not.toHaveBeenCalled();
    expect(grantPermissionsToRole).toHaveBeenCalledWith({ roleKey: "admin", permissionKeys: ["broadcast.manage"] });
  });

  it("runs migrations, marks installed and grants admin permissions", async () => {
    const { installPlugin } = await import("./install-plugin");
    const result = await installPlugin({ pluginKey: "broadcast" });

    expect(runPluginMigrations).toHaveBeenCalledWith("broadcast");
    expect(setExtensionInstalled).toHaveBeenCalledWith({ kind: "plugin", key: "broadcast" });
    expect(grantPermissionsToRole).toHaveBeenCalledWith({ roleKey: "admin", permissionKeys: ["broadcast.manage"] });
    expect(result).toEqual({ success: true, data: undefined });
  });

  it("does not mark installed or grant when the migration fails", async () => {
    runPluginMigrations.mockResolvedValue({
      success: false,
      error: { code: "plugin-engine.migrations.failed", message: "boom" },
    });

    const { installPlugin } = await import("./install-plugin");
    const result = await installPlugin({ pluginKey: "broadcast" });

    expect(result).toEqual({ success: false, error: { code: "plugin-engine.migrations.failed", message: "boom" } });
    expect(setExtensionInstalled).not.toHaveBeenCalled();
    expect(grantPermissionsToRole).not.toHaveBeenCalled();
  });

  it("returns the grant error when granting admin permissions fails", async () => {
    grantPermissionsToRole.mockResolvedValue({
      success: false,
      error: { code: "rbac.roles.not_found", message: "no admin role" },
    });

    const { installPlugin } = await import("./install-plugin");
    const result = await installPlugin({ pluginKey: "broadcast" });

    expect(result).toEqual({ success: false, error: { code: "rbac.roles.not_found", message: "no admin role" } });
  });

  it("skips migrations and the grant for a plugin without migrationsPath or permissions", async () => {
    const { installPlugin } = await import("./install-plugin");
    const result = await installPlugin({ pluginKey: "donations" });

    expect(runPluginMigrations).not.toHaveBeenCalled();
    expect(setExtensionInstalled).toHaveBeenCalledWith({ kind: "plugin", key: "donations" });
    expect(grantPermissionsToRole).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: undefined });
  });
});
