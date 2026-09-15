import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAuditEvent = vi.fn();
vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const findUserStatus = vi.fn();
const anonymizeUser = vi.fn();
vi.mock("./store", () => ({
  findUserStatus: (...args: unknown[]) => findUserStatus(...args),
  anonymizeUser: (...args: unknown[]) => anonymizeUser(...args),
}));

describe("removeUser", () => {
  beforeEach(() => {
    recordAuditEvent.mockReset();
    findUserStatus.mockReset();
    anonymizeUser.mockReset();
  });

  it("anonymizes an approved user and audits", async () => {
    findUserStatus.mockResolvedValue("approved");
    anonymizeUser.mockResolvedValue({ id: "target-1" });

    const { removeUser } = await import("./service");
    const result = await removeUser({ actorId: "admin-1", targetUserId: "target-1", reason: "solicitado" });

    expect(anonymizeUser).toHaveBeenCalledWith("target-1");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.remove-user",
        detail: { targetUserId: "target-1", reason: "solicitado" },
      }),
    );
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });

  it("fails when the target user does not exist, without auditing", async () => {
    findUserStatus.mockResolvedValue(null);

    const { removeUser } = await import("./service");
    const result = await removeUser({ actorId: "admin-1", targetUserId: "missing" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.user_not_found", message: expect.any(String) },
    });
    expect(anonymizeUser).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("fails when the target user is already removed, without auditing", async () => {
    findUserStatus.mockResolvedValue("removed");

    const { removeUser } = await import("./service");
    const result = await removeUser({ actorId: "admin-1", targetUserId: "target-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.already_removed", message: expect.any(String) },
    });
    expect(anonymizeUser).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
