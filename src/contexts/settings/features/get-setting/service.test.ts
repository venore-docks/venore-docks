import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateCache } from "../../../../infrastructure/cache/memory-cache";

const syncSettingsCacheVersion = vi.fn();

vi.mock("../../settings-cache-version", () => ({
  syncSettingsCacheVersion: (...args: unknown[]) => syncSettingsCacheVersion(...args),
}));

const findSettingByKey = vi.fn();

vi.mock("./store", () => ({
  findSettingByKey: (...args: unknown[]) => findSettingByKey(...args),
}));

describe("getSetting", () => {
  beforeEach(() => {
    findSettingByKey.mockReset();
    syncSettingsCacheVersion.mockReset();
    invalidateCache("settings:theme.active");
    invalidateCache("settings:missing.key");
  });

  afterEach(() => {
    invalidateCache("settings:theme.active");
    invalidateCache("settings:missing.key");
  });

  it("reads the store and populates the cache on a cache miss", async () => {
    findSettingByKey.mockResolvedValue({ key: "theme.active", value: "default", updatedAt: new Date("2026-01-01") });

    const { getSetting } = await import("./service");
    const result = await getSetting({ key: "theme.active" });

    expect(findSettingByKey).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, data: { key: "theme.active", value: "default", updatedAt: new Date("2026-01-01") } });
  });

  it("does not hit the store again on a cache hit", async () => {
    findSettingByKey.mockResolvedValue({ key: "theme.active", value: "default", updatedAt: new Date() });

    const { getSetting } = await import("./service");
    await getSetting({ key: "theme.active" });
    await getSetting({ key: "theme.active" });

    expect(findSettingByKey).toHaveBeenCalledTimes(1);
  });

  it("caches a missing key as null instead of hitting the store on every call", async () => {
    findSettingByKey.mockResolvedValue(null);

    const { getSetting } = await import("./service");
    const first = await getSetting({ key: "missing.key" });
    const second = await getSetting({ key: "missing.key" });

    expect(findSettingByKey).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ success: true, data: null });
    expect(second).toEqual({ success: true, data: null });
  });
});
