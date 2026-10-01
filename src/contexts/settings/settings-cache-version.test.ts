import { beforeEach, describe, expect, it, vi } from "vitest";

const readCacheVersion = vi.fn();
const bumpCacheVersion = vi.fn();
vi.mock("../../infrastructure/cache/cache-version", () => ({
  readCacheVersion: (...args: unknown[]) => readCacheVersion(...args),
  bumpCacheVersion: (...args: unknown[]) => bumpCacheVersion(...args),
}));

import { getCache, setCache } from "../../infrastructure/cache/memory-cache";
import { forgetSettingsByPrefix, publishSettingsChange, syncSettingsCacheVersion } from "./settings-cache-version";

type VersionGlobal = typeof globalThis & { __venoreSettingsCacheVersion?: unknown };

describe("settings cache version", () => {
  beforeEach(() => {
    delete (globalThis as VersionGlobal).__venoreSettingsCacheVersion;
    readCacheVersion.mockReset();
    bumpCacheVersion.mockReset();
    vi.useRealTimers();
  });

  it("drops the local settings cache when another instance bumped the version", async () => {
    readCacheVersion.mockResolvedValueOnce(1);
    await syncSettingsCacheVersion();
    setCache("settings:nav.hideLoginLink", { record: null }, 300);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 6_000);
    readCacheVersion.mockResolvedValueOnce(2);
    await syncSettingsCacheVersion();

    expect(getCache("settings:nav.hideLoginLink")).toBeNull();
  });

  it("keeps the cache when the version is unchanged and checks the database at most every 5 s", async () => {
    readCacheVersion.mockResolvedValue(7);
    await syncSettingsCacheVersion();
    setCache("settings:header.sticky", { record: null }, 300);

    await syncSettingsCacheVersion();
    expect(readCacheVersion).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 6_000);
    await syncSettingsCacheVersion();

    expect(readCacheVersion).toHaveBeenCalledTimes(2);
    expect(getCache("settings:header.sticky")).toEqual({ record: null });
  });

  it("does not throw when publishing fails (the write already happened)", async () => {
    bumpCacheVersion.mockRejectedValue(new Error("db down"));
    await expect(publishSettingsChange()).resolves.toBeUndefined();
  });

  it("forgetSettingsByPrefix drops only that namespace locally and publishes the change", async () => {
    setCache("settings:donations.goal", { record: null }, 300);
    setCache("settings:theme.active", { record: null }, 300);

    await forgetSettingsByPrefix("donations.");

    expect(getCache("settings:donations.goal")).toBeNull();
    expect(getCache("settings:theme.active")).toEqual({ record: null });
    expect(bumpCacheVersion).toHaveBeenCalledWith("settings");
  });
});
