import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "user-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const findUserStatus = vi.fn();
const updateUserStatus = vi.fn();

vi.mock("./store", () => ({
  findUserStatus: (...args: unknown[]) => findUserStatus(...args),
  updateUserStatus: (...args: unknown[]) => updateUserStatus(...args),
}));

describe("rejectUserRegistration", () => {
  beforeEach(() => {
    findUserStatus.mockReset();
    updateUserStatus.mockReset();
  });

  it("fails when the user is not pending", async () => {
    findUserStatus.mockResolvedValue("approved");

    const { rejectUserRegistration } = await import("./service");
    const result = await rejectUserRegistration({ userId: "user-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.registrations.not_pending", message: expect.any(String) },
    });
    expect(updateUserStatus).not.toHaveBeenCalled();
  });

  it("rejects a pending user", async () => {
    findUserStatus.mockResolvedValue("pending");
    updateUserStatus.mockResolvedValue(undefined);

    const { rejectUserRegistration } = await import("./service");
    const result = await rejectUserRegistration({ userId: "user-1" });

    expect(updateUserStatus).toHaveBeenCalledWith("user-1", "rejected");
    expect(result).toEqual({ success: true, data: undefined });
  });
});
