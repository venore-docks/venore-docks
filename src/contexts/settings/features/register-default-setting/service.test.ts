import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "system", type: "system" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const invalidateCache = vi.fn();

vi.mock("../../../../infrastructure/cache/memory-cache", () => ({
  invalidateCache: (...args: unknown[]) => invalidateCache(...args),
}));

const insertSettingIfMissing = vi.fn();

vi.mock("./store", () => ({
  insertSettingIfMissing: (...args: unknown[]) => insertSettingIfMissing(...args),
}));

describe("registerDefaultSetting", () => {
  beforeEach(async () => {
    invalidateCache.mockReset();
    insertSettingIfMissing.mockReset();
    const { forgetConfirmedDefaultSettings } = await import("./service");
    forgetConfirmedDefaultSettings("");
  });

  it("only hits the database once per key per process", async () => {
    insertSettingIfMissing.mockResolvedValue(false);

    const { registerDefaultSetting } = await import("./service");
    await registerDefaultSetting({ key: "header.sticky", value: true });
    await registerDefaultSetting({ key: "header.sticky", value: true });

    expect(insertSettingIfMissing).toHaveBeenCalledTimes(1);
  });

  it("hits the database again after forgetConfirmedDefaultSettings for that prefix", async () => {
    insertSettingIfMissing.mockResolvedValue(false);

    const { registerDefaultSetting, forgetConfirmedDefaultSettings } = await import("./service");
    await registerDefaultSetting({ key: "birthdays.reminder_days", value: 7 });
    await registerDefaultSetting({ key: "header.sticky", value: true });
    forgetConfirmedDefaultSettings("birthdays.");
    await registerDefaultSetting({ key: "birthdays.reminder_days", value: 7 });
    await registerDefaultSetting({ key: "header.sticky", value: true });

    expect(insertSettingIfMissing).toHaveBeenCalledTimes(3);
  });

  it("inserts the default and invalidates the cache when the key is missing", async () => {
    insertSettingIfMissing.mockResolvedValue(true);

    const { registerDefaultSetting } = await import("./service");
    const result = await registerDefaultSetting({ key: "birthdays.reminder_days", value: 7 });

    expect(insertSettingIfMissing).toHaveBeenCalledWith("birthdays.reminder_days", 7);
    expect(invalidateCache).toHaveBeenCalledWith("settings:birthdays.reminder_days");
    expect(result).toEqual({ success: true, data: { key: "birthdays.reminder_days", registered: true } });
  });

  it("does not touch the cache when the key already exists (admin value preserved)", async () => {
    insertSettingIfMissing.mockResolvedValue(false);

    const { registerDefaultSetting } = await import("./service");
    const result = await registerDefaultSetting({ key: "theme.active", value: "default" });

    expect(invalidateCache).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: { key: "theme.active", registered: false } });
  });
});
