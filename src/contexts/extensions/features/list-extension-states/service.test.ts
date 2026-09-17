import { beforeEach, describe, expect, it, vi } from "vitest";

const findExtensionStatesByKind = vi.fn();

vi.mock("./store", () => ({
  findExtensionStatesByKind: (...args: unknown[]) => findExtensionStatesByKind(...args),
}));

describe("listExtensionStates", () => {
  beforeEach(() => {
    findExtensionStatesByKind.mockReset();
  });

  it("maps the rows to a key -> { installed, enabled } record", async () => {
    const installedAt = new Date("2026-01-01T00:00:00Z");
    findExtensionStatesByKind.mockResolvedValue([
      { key: "birthdays", enabled: false, installedAt },
      { key: "academy", enabled: true, installedAt },
      { key: "broadcast", enabled: true, installedAt: null },
    ]);

    const { listExtensionStates } = await import("./service");
    const result = await listExtensionStates({ kind: "plugin" });

    expect(result).toEqual({
      success: true,
      data: {
        birthdays: { installed: true, enabled: false },
        academy: { installed: true, enabled: true },
        broadcast: { installed: false, enabled: true },
      },
    });
  });

  it("reads fresh from the store on every call (no cache, by design — see service.ts)", async () => {
    findExtensionStatesByKind.mockResolvedValue([]);

    const { listExtensionStates } = await import("./service");
    await listExtensionStates({ kind: "plugin" });
    await listExtensionStates({ kind: "plugin" });

    expect(findExtensionStatesByKind).toHaveBeenCalledTimes(2);
  });
});
