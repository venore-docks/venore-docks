import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const removeUser = vi.fn();
vi.mock("./service", () => ({
  removeUser: (...args: unknown[]) => removeUser(...args),
}));

describe("removeUserHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    removeUser.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "admin-1" });
  });

  it("rejects an empty targetUserId without checking authorization", async () => {
    const { removeUserHandler } = await import("./handler");
    const result = await removeUserHandler({ targetUserId: "  " });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.invalid_id", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
    expect(removeUser).not.toHaveBeenCalled();
  });

  it("rejects an actor without rbac.users.remove", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { removeUserHandler } = await import("./handler");
    const result = await removeUserHandler({ targetUserId: "target-1" });

    expect(authorizeActor).toHaveBeenCalledWith("rbac.users.remove");
    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(removeUser).not.toHaveBeenCalled();
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    removeUser.mockResolvedValue({ success: true, data: { id: "target-1" } });

    const { removeUserHandler } = await import("./handler");
    const result = await removeUserHandler({ targetUserId: "target-1", reason: "solicitado" });

    expect(removeUser).toHaveBeenCalledWith({ actorId: "admin-1", targetUserId: "target-1", reason: "solicitado" });
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });
});
