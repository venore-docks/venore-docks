import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const upsertExtensionInstalled = vi.fn();

vi.mock("./store", () => ({
  upsertExtensionInstalled: (...args: unknown[]) => upsertExtensionInstalled(...args),
}));

describe("setExtensionInstalled", () => {
  beforeEach(() => {
    upsertExtensionInstalled.mockReset();
  });

  it("persists the installed mark", async () => {
    const record = {
      kind: "plugin" as const,
      key: "broadcast",
      enabled: true,
      installedAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      updatedByUserId: "actor-1",
    };
    upsertExtensionInstalled.mockResolvedValue(record);

    const { setExtensionInstalled } = await import("./service");
    const result = await setExtensionInstalled({ kind: "plugin", key: "broadcast", actorId: "actor-1" });

    expect(upsertExtensionInstalled).toHaveBeenCalledWith("plugin", "broadcast", "actor-1");
    expect(result).toEqual({ success: true, data: record });
  });
});
