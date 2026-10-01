import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "user-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const invalidateCache = vi.fn();

vi.mock("../../../../infrastructure/cache/memory-cache", () => ({
  invalidateCache: (...args: unknown[]) => invalidateCache(...args),
}));

const publishSettingsChange = vi.fn();

vi.mock("../../settings-cache-version", () => ({
  publishSettingsChange: (...args: unknown[]) => publishSettingsChange(...args),
}));

const upsertSetting = vi.fn();

vi.mock("./store", () => ({
  upsertSetting: (...args: unknown[]) => upsertSetting(...args),
}));

describe("setSetting", () => {
  beforeEach(() => {
    invalidateCache.mockReset();
    publishSettingsChange.mockReset();
    upsertSetting.mockReset();
  });

  it("publishes the change so other instances drop their settings cache", async () => {
    upsertSetting.mockResolvedValue({ key: "nav.hideLoginLink", value: true, updatedAt: new Date("2026-01-01") });

    const { setSetting } = await import("./service");
    await setSetting({ key: "nav.hideLoginLink", value: true, actorId: "user-1" });

    expect(publishSettingsChange).toHaveBeenCalledTimes(1);
  });

  it("persists the value and invalidates the cache for that key", async () => {
    upsertSetting.mockResolvedValue({ key: "theme.active", value: "default", updatedAt: new Date("2026-01-01") });

    const { setSetting } = await import("./service");
    const result = await setSetting({ key: "theme.active", value: "default", actorId: "user-1" });

    expect(upsertSetting).toHaveBeenCalledWith("theme.active", "default");
    expect(invalidateCache).toHaveBeenCalledWith("settings:theme.active");
    expect(result).toEqual({ success: true, data: { key: "theme.active", value: "default", updatedAt: new Date("2026-01-01") } });
  });
});
