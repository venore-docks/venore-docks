import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
}));

const markUserApproved = vi.fn();
vi.mock("./store", () => ({ markUserApproved: (...args: unknown[]) => markUserApproved(...args) }));

describe("activateUser", () => {
  beforeEach(() => markUserApproved.mockReset());

  it("approves the account", async () => {
    markUserApproved.mockResolvedValue(true);
    const { activateUser } = await import("./service");
    expect(await activateUser({ userId: "u1", reason: "bootstrap" })).toEqual({ success: true, data: undefined });
    expect(markUserApproved).toHaveBeenCalledWith("u1");
  });

  it("fails for an unknown user", async () => {
    markUserApproved.mockResolvedValue(false);
    const { activateUser } = await import("./service");
    const result = await activateUser({ userId: "nope", reason: "bootstrap" });
    expect(result).toEqual({ success: false, error: { code: "auth.identity.user_not_found", message: expect.any(String) } });
  });
});
