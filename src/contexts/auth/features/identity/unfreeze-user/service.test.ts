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

describe("unfreezeUser", () => {
  beforeEach(() => {
    recordAuditEvent.mockReset();
    findUserStatus.mockReset();
    writeUserStatus.mockReset();
  });

  it("reactivates a frozen user and audits", async () => {
    findUserStatus.mockResolvedValue("frozen");
    writeUserStatus.mockResolvedValue({ id: "target-1" });

    const { unfreezeUser } = await import("./service");
    const result = await unfreezeUser({ actorId: "admin-1", targetUserId: "target-1" });

    expect(writeUserStatus).toHaveBeenCalledWith("target-1", "approved");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.unfreeze-user", detail: { targetUserId: "target-1" } }),
    );
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });

  it("fails when the target user does not exist, without auditing", async () => {
    findUserStatus.mockResolvedValue(null);

    const { unfreezeUser } = await import("./service");
    const result = await unfreezeUser({ actorId: "admin-1", targetUserId: "missing" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.user_not_found", message: expect.any(String) },
    });
    expect(writeUserStatus).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("fails when the target user is not frozen, without auditing", async () => {
    findUserStatus.mockResolvedValue("approved");

    const { unfreezeUser } = await import("./service");
    const result = await unfreezeUser({ actorId: "admin-1", targetUserId: "target-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.not_frozen", message: expect.any(String) },
    });
    expect(writeUserStatus).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
