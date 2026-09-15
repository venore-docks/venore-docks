import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAuditEvent = vi.fn();
vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const findRemovedUserStatus = vi.fn();
const hardDeleteUserById = vi.fn();
vi.mock("./store", () => ({
  findRemovedUserStatus: (...args: unknown[]) => findRemovedUserStatus(...args),
  hardDeleteUserById: (...args: unknown[]) => hardDeleteUserById(...args),
  isForeignKeyViolation: (error: unknown) =>
    typeof error === "object" && error !== null && (error as { code?: string }).code === "23503",
}));

describe("purgeUser", () => {
  beforeEach(() => {
    recordAuditEvent.mockReset();
    findRemovedUserStatus.mockReset();
    hardDeleteUserById.mockReset();
  });

  it("hard-deletes a removed user and audits", async () => {
    findRemovedUserStatus.mockResolvedValue("removed");
    hardDeleteUserById.mockResolvedValue(undefined);

    const { purgeUser } = await import("./service");
    const result = await purgeUser({ actorId: "admin-1", targetUserId: "target-1" });

    expect(hardDeleteUserById).toHaveBeenCalledWith("target-1");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.purge-user", detail: { targetUserId: "target-1" } }),
    );
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });

  it("fails when the target user does not exist, without auditing", async () => {
    findRemovedUserStatus.mockResolvedValue(null);

    const { purgeUser } = await import("./service");
    const result = await purgeUser({ actorId: "admin-1", targetUserId: "missing" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.user_not_found", message: expect.any(String) },
    });
    expect(hardDeleteUserById).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("fails when the target user is not removed, without auditing", async () => {
    findRemovedUserStatus.mockResolvedValue("frozen");

    const { purgeUser } = await import("./service");
    const result = await purgeUser({ actorId: "admin-1", targetUserId: "target-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.purge.not_removed", message: expect.any(String) },
    });
    expect(hardDeleteUserById).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("translates a foreign-key violation into still_referenced, without auditing", async () => {
    findRemovedUserStatus.mockResolvedValue("removed");
    hardDeleteUserById.mockRejectedValue({ code: "23503" });

    const { purgeUser } = await import("./service");
    const result = await purgeUser({ actorId: "admin-1", targetUserId: "target-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.purge.still_referenced", message: expect.any(String) },
    });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
