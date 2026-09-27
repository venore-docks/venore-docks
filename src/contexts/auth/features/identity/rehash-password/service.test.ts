import { beforeEach, describe, expect, it, vi } from "vitest";

const replacePasswordHash = vi.fn();
vi.mock("./store", () => ({ replacePasswordHash: (...args: unknown[]) => replacePasswordHash(...args) }));

describe("rehashPassword", () => {
  beforeEach(() => replacePasswordHash.mockReset().mockResolvedValue(true));

  it("is a no-op for a hash with current parameters", async () => {
    const { rehashPassword } = await import("./service");
    const result = await rehashPassword({ userId: "u", password: "x", storedHash: "scrypt2$32768$8$3$AAAA$BBBB" });
    expect(result).toEqual({ success: true, data: { rehashed: false } });
    expect(replacePasswordHash).not.toHaveBeenCalled();
  });

  it("rewrites a legacy hash with compare-and-swap", async () => {
    const { rehashPassword } = await import("./service");
    const result = await rehashPassword({ userId: "u", password: "x", storedHash: "scrypt$AAAA$BBBB" });
    expect(result).toEqual({ success: true, data: { rehashed: true } });
    expect(replacePasswordHash).toHaveBeenCalledWith("u", "scrypt$AAAA$BBBB", expect.stringMatching(/^scrypt2\$/));
  });
});
