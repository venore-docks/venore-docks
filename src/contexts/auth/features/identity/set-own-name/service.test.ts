import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
}));

const writeOwnName = vi.fn();
vi.mock("./store", () => ({
  writeOwnName: (...args: unknown[]) => writeOwnName(...args),
}));

describe("setOwnName", () => {
  beforeEach(() => {
    writeOwnName.mockReset();
  });

  it("trims and writes the name for the actor", async () => {
    writeOwnName.mockResolvedValue({ id: "user-1" });

    const { setOwnName } = await import("./service");
    const result = await setOwnName({ actorId: "user-1", name: "  Ana Silva  " });

    expect(writeOwnName).toHaveBeenCalledWith("user-1", "Ana Silva");
    expect(result).toEqual({ success: true, data: { id: "user-1" } });
  });

  it("rejects an empty (or whitespace-only) name without writing", async () => {
    const { setOwnName } = await import("./service");
    const result = await setOwnName({ actorId: "user-1", name: "   " });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.invalid_name", message: expect.any(String) },
    });
    expect(writeOwnName).not.toHaveBeenCalled();
  });

  it("fails when the user row does not exist", async () => {
    writeOwnName.mockResolvedValue(null);

    const { setOwnName } = await import("./service");
    const result = await setOwnName({ actorId: "ghost", name: "Ana" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.user_not_found", message: expect.any(String) },
    });
  });
});
