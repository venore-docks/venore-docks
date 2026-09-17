import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const upsertExtensionState = vi.fn();

vi.mock("./store", () => ({
  upsertExtensionState: (...args: unknown[]) => upsertExtensionState(...args),
}));

describe("setExtensionEnabled", () => {
  beforeEach(() => {
    upsertExtensionState.mockReset();
  });

  it("persists the new state", async () => {
    const record = { kind: "plugin" as const, key: "birthdays", enabled: false, updatedAt: new Date("2026-01-01"), updatedByUserId: "actor-1" };
    upsertExtensionState.mockResolvedValue(record);

    const { setExtensionEnabled } = await import("./service");
    const result = await setExtensionEnabled({ kind: "plugin", key: "birthdays", enabled: false, actorId: "actor-1" });

    expect(upsertExtensionState).toHaveBeenCalledWith("plugin", "birthdays", false, "actor-1");
    expect(result).toEqual({ success: true, data: record });
  });
});
