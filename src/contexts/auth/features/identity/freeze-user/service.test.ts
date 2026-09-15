import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAuditEvent = vi.fn();
vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const findUserStatus = vi.fn();
const writeUserStatus = vi.fn();
vi.mock("./store", () => ({
  findUserStatus: (...args: unknown[]) => findUserStatus(...args),
  writeUserStatus: (...args: unknown[]) => writeUserStatus(...args),
}));

describe("freezeUser", () => {
  beforeEach(() => {
    recordAuditEvent.mockReset();
    findUserStatus.mockReset();
    writeUserStatus.mockReset();
  });

  it("freezes an approved user and audits", async () => {
    findUserStatus.mockResolvedValue("approved");
    writeUserStatus.mockResolvedValue({ id: "target-1" });

    const { freezeUser } = await import("./service");
    const result = await freezeUser({ actorId: "admin-1", targetUserId: "target-1", reason: "abuso" });

    expect(writeUserStatus).toHaveBeenCalledWith("target-1", "frozen");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.freeze-user",
        detail: { targetUserId: "target-1", reason: "abuso" },
      }),
    );
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });

  it("fails when the target user does not exist, without auditing", async () => {
    findUserStatus.mockResolvedValue(null);

    const { freezeUser } = await import("./service");
    const result = await freezeUser({ actorId: "admin-1", targetUserId: "missing" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.user_not_found", message: expect.any(String) },
    });
    expect(writeUserStatus).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("fails when the target user is not approved, without auditing", async () => {
    findUserStatus.mockResolvedValue("pending");

    const { freezeUser } = await import("./service");
    const result = await freezeUser({ actorId: "admin-1", targetUserId: "target-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.not_approved", message: expect.any(String) },
    });
    expect(writeUserStatus).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
