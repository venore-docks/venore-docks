import { beforeEach, describe, expect, it, vi } from "vitest";

const registerPlugins = vi.fn();
vi.mock("./register-plugins", () => ({
  registerPlugins: (...args: unknown[]) => registerPlugins(...args),
  getPluginRegistrationReport: (...args: unknown[]) => registerPlugins(...args),
}));

describe("isPluginActive", () => {
  beforeEach(() => {
    registerPlugins.mockReset();
  });

  it("is true when the plugin's registration entry is active", async () => {
    registerPlugins.mockResolvedValue({ entries: [{ key: "academy", status: "active" }] });

    const { isPluginActive } = await import("./is-plugin-active");
    expect(await isPluginActive("academy")).toBe(true);
  });

  it("is false when the plugin was disabled by the admin", async () => {
    registerPlugins.mockResolvedValue({ entries: [{ key: "academy", status: "disabled" }] });

    const { isPluginActive } = await import("./is-plugin-active");
    expect(await isPluginActive("academy")).toBe(false);
  });

  it("is false when the plugin key has no registration entry at all", async () => {
    registerPlugins.mockResolvedValue({ entries: [] });

    const { isPluginActive } = await import("./is-plugin-active");
    expect(await isPluginActive("academy")).toBe(false);
  });
});
