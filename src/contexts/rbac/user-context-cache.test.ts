import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRbacContext } from "./contracts/types";

let dbVersion = 0;
const bumpCacheVersion = vi.fn(async () => {
  dbVersion += 1;
});
vi.mock("@/infrastructure/cache/cache-version", () => ({
  bumpCacheVersion: () => bumpCacheVersion(),
  readCacheVersion: async () => dbVersion,
}));

function makeContext(overrides: Partial<UserRbacContext> = {}): UserRbacContext {
  return {
    userId: "user-1",
    roles: [],
    permissions: [],
    isSuperadmin: false,
    scopedPermissions: {},
    ...overrides,
  };
}

describe("user-context-cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    delete (globalThis as { __venoreRbacUserContextCache?: unknown }).__venoreRbacUserContextCache;
    dbVersion = 0;
    bumpCacheVersion.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for a userId that was never cached", async () => {
    const { getCachedUserContext } = await import("./user-context-cache");
    expect(getCachedUserContext("nobody")).toBeNull();
  });

  it("returns the cached value before the TTL expires", async () => {
    const { getCachedUserContext, setCachedUserContext } = await import("./user-context-cache");
    const context = makeContext();

    setCachedUserContext("user-1", context);

    expect(getCachedUserContext("user-1")).toEqual(context);
  });

  it("expires the entry after the TTL", async () => {
    const { getCachedUserContext, setCachedUserContext } = await import("./user-context-cache");
    setCachedUserContext("user-1", makeContext());

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(getCachedUserContext("user-1")).toBeNull();
  });

  it("removes the entry when invalidated", async () => {
    const { getCachedUserContext, setCachedUserContext, invalidateUserContext } = await import("./user-context-cache");
    setCachedUserContext("user-1", makeContext());

    await invalidateUserContext("user-1");

    expect(getCachedUserContext("user-1")).toBeNull();
    expect(bumpCacheVersion).toHaveBeenCalledTimes(1);
  });

  it("drops the local cache once another instance bumps the version", async () => {
    const { getCachedUserContext, setCachedUserContext, syncUserContextCacheVersion } = await import("./user-context-cache");
    await syncUserContextCacheVersion();
    setCachedUserContext("user-1", makeContext());

    dbVersion += 1; // outra instância removeu um papel
    await syncUserContextCacheVersion();
    expect(getCachedUserContext("user-1")).not.toBeNull(); // ainda dentro do intervalo de checagem

    vi.advanceTimersByTime(5 * 1000 + 1);
    await syncUserContextCacheVersion();
    expect(getCachedUserContext("user-1")).toBeNull();
  });

  it("is shared through globalThis across module copies", async () => {
    const first = await import("./user-context-cache");
    first.setCachedUserContext("user-1", makeContext());
    vi.resetModules();
    const second = await import("./user-context-cache");
    expect(second.getCachedUserContext("user-1")).not.toBeNull();
  });
});
