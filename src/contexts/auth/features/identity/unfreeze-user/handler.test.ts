import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const unfreezeUser = vi.fn();
vi.mock("./service", () => ({
  unfreezeUser: (...args: unknown[]) => unfreezeUser(...args),
}));

describe("unfreezeUserHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    unfreezeUser.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "admin-1" });
  });

  it("rejects an empty targetUserId without checking authorization", async () => {
    const { unfreezeUserHandler } = await import("./handler");
    const result = await unfreezeUserHandler({ targetUserId: "  " });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.invalid_id", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
    expect(unfreezeUser).not.toHaveBeenCalled();
  });

  it("rejects an actor without rbac.users.manage", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { unfreezeUserHandler } = await import("./handler");
    const result = await unfreezeUserHandler({ targetUserId: "target-1" });

    expect(authorizeActor).toHaveBeenCalledWith("rbac.users.manage");
    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(unfreezeUser).not.toHaveBeenCalled();
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    unfreezeUser.mockResolvedValue({ success: true, data: { id: "target-1" } });

    const { unfreezeUserHandler } = await import("./handler");
    const result = await unfreezeUserHandler({ targetUserId: "target-1" });

    expect(unfreezeUser).toHaveBeenCalledWith({ actorId: "admin-1", targetUserId: "target-1" });
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });
});
