import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const purgeUser = vi.fn();
vi.mock("./service", () => ({
  purgeUser: (...args: unknown[]) => purgeUser(...args),
}));

describe("purgeUserHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    purgeUser.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "admin-1" });
  });

  it("rejects an empty targetUserId without checking authorization", async () => {
    const { purgeUserHandler } = await import("./handler");
    const result = await purgeUserHandler({ targetUserId: "  " });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.invalid_id", message: expect.any(String) },
    });
    expect(authorizeActor).not.toHaveBeenCalled();
    expect(purgeUser).not.toHaveBeenCalled();
  });

  it("rejects an actor without rbac.users.purge", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { purgeUserHandler } = await import("./handler");
    const result = await purgeUserHandler({ targetUserId: "target-1" });

    expect(authorizeActor).toHaveBeenCalledWith("rbac.users.purge");
    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(purgeUser).not.toHaveBeenCalled();
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    purgeUser.mockResolvedValue({ success: true, data: { id: "target-1" } });

    const { purgeUserHandler } = await import("./handler");
    const result = await purgeUserHandler({ targetUserId: "target-1" });

    expect(purgeUser).toHaveBeenCalledWith({ actorId: "admin-1", targetUserId: "target-1" });
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });
});
