import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...args: unknown[]) => authorizeActor(...args),
}));

const adminCreateUser = vi.fn();
vi.mock("./service", () => ({
  adminCreateUser: (...args: unknown[]) => adminCreateUser(...args),
}));

describe("adminCreateUserHandler", () => {
  beforeEach(() => {
    authorizeActor.mockReset();
    adminCreateUser.mockReset();
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "admin-1" });
  });

  it("rejects an actor without rbac.users.manage", async () => {
    authorizeActor.mockResolvedValue({
      authorized: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });

    const { adminCreateUserHandler } = await import("./handler");
    const result = await adminCreateUserHandler({ email: "new@example.com", name: "Novo", password: "supersecret" });

    expect(authorizeActor).toHaveBeenCalledWith("rbac.users.manage");
    expect(result).toEqual({
      success: false,
      error: { code: "rbac.authorization.forbidden", message: "sem permission" },
    });
    expect(adminCreateUser).not.toHaveBeenCalled();
  });

  it("delegates to the service with the resolved actor when authorized", async () => {
    adminCreateUser.mockResolvedValue({ success: true, data: { id: "user-1", email: "new@example.com", name: "Novo" } });

    const { adminCreateUserHandler } = await import("./handler");
    const result = await adminCreateUserHandler({ email: "new@example.com", name: "Novo", password: "supersecret" });

    expect(adminCreateUser).toHaveBeenCalledWith({
      actorId: "admin-1",
      email: "new@example.com",
      name: "Novo",
      password: "supersecret",
    });
    expect(result).toEqual({ success: true, data: { id: "user-1", email: "new@example.com", name: "Novo" } });
  });
});
