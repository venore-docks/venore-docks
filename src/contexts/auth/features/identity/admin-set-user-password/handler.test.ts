import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActorOverUser: (...args: unknown[]) => authorizeActor(...args),
}));

const adminSetUserPassword = vi.fn();
vi.mock("./service", () => ({
  adminSetUserPassword: (...args: unknown[]) => adminSetUserPassword(...args),
}));

describe("adminSetUserPasswordHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    adminSetUserPassword.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "admin-1" });
  });

  it("rejects an empty targetUserId without checking authorization", async () => {
    const { adminSetUserPasswordHandler } = await import("./handler");
    const result = await adminSetUserPasswordHandler({ targetUserId: "  ", newPassword: "supersecret" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.invalid_id", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
    expect(adminSetUserPassword).not.toHaveBeenCalled();
  });

  it("rejects an actor without rbac.roles.manage", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { adminSetUserPasswordHandler } = await import("./handler");
    const result = await adminSetUserPasswordHandler({ targetUserId: "target-1", newPassword: "supersecret" });

    expect(authorizeActor).toHaveBeenCalledWith("rbac.roles.manage", expect.any(String), { allowSelf: true });
    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(adminSetUserPassword).not.toHaveBeenCalled();
  });

  it("skips authorization and uses the target as actor when bypassAuthorization is set", async () => {
    adminSetUserPassword.mockResolvedValue({ success: true, data: { id: "target-1" } });

    const { adminSetUserPasswordHandler } = await import("./handler");
    const result = await adminSetUserPasswordHandler({
      targetUserId: "target-1",
      newPassword: "supersecret",
      bypassAuthorization: true,
    });

    expect(authorizeActor).not.toHaveBeenCalled();
    expect(adminSetUserPassword).toHaveBeenCalledWith({
      actorId: "target-1",
      targetUserId: "target-1",
      newPassword: "supersecret",
    });
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    adminSetUserPassword.mockResolvedValue({ success: true, data: { id: "target-1" } });

    const { adminSetUserPasswordHandler } = await import("./handler");
    const result = await adminSetUserPasswordHandler({ targetUserId: "target-1", newPassword: "supersecret" });

    expect(adminSetUserPassword).toHaveBeenCalledWith({
      actorId: "admin-1",
      targetUserId: "target-1",
      newPassword: "supersecret",
    });
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });
});
