import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const freezeUser = vi.fn();
vi.mock("./service", () => ({
  freezeUser: (...args: unknown[]) => freezeUser(...args),
}));

describe("freezeUserHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    freezeUser.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "admin-1" });
  });

  it("rejects an empty targetUserId without checking authorization", async () => {
    const { freezeUserHandler } = await import("./handler");
    const result = await freezeUserHandler({ targetUserId: "  " });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.invalid_id", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
    expect(freezeUser).not.toHaveBeenCalled();
  });

  it("rejects an actor without rbac.users.manage", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { freezeUserHandler } = await import("./handler");
    const result = await freezeUserHandler({ targetUserId: "target-1" });

    expect(authorizeActor).toHaveBeenCalledWith("rbac.users.manage");
    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(freezeUser).not.toHaveBeenCalled();
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    freezeUser.mockResolvedValue({ success: true, data: { id: "target-1" } });

    const { freezeUserHandler } = await import("./handler");
    const result = await freezeUserHandler({ targetUserId: "target-1", reason: "abuso" });

    expect(freezeUser).toHaveBeenCalledWith({ actorId: "admin-1", targetUserId: "target-1", reason: "abuso" });
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });
});
