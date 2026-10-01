import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "admin-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

const approveUserRegistration = vi.fn();

vi.mock("@/contexts/auth", () => ({
  approveUserRegistration: (...args: unknown[]) => approveUserRegistration(...args),
}));

const assignRoleToUser = vi.fn();

vi.mock("../../role-assignment/assign-role-to-user/service", () => ({
  assignRoleToUser: (...args: unknown[]) => assignRoleToUser(...args),
}));

const findRoleIdByKey = vi.fn();

vi.mock("../../role-assignment/assign-default-role/store", () => ({
  findRoleIdByKey: (...args: unknown[]) => findRoleIdByKey(...args),
}));

vi.mock("../../role-assignment/assign-default-role/service", () => ({
  resolveDefaultRegistrationRoleKey: (requested: string | undefined) =>
    requested === "superadmin"
      ? { success: false, error: { code: "rbac.roles.default_role_forbidden", message: "proibido" } }
      : { success: true, data: requested ?? "member" },
}));

describe("approveRegistration", () => {
  beforeEach(() => {
    approveUserRegistration.mockReset();
    assignRoleToUser.mockReset();
    findRoleIdByKey.mockReset();
  });

  it("fails without assigning a role when the user was not pending", async () => {
    const error = { code: "auth.registrations.not_pending", message: "não pendente" };
    approveUserRegistration.mockResolvedValue({ success: false, error });
    findRoleIdByKey.mockResolvedValue("role-member");

    const { approveRegistration } = await import("./service");
    const result = await approveRegistration({ userId: "user-1", actor: { id: "admin-1" } });

    expect(result).toEqual({ success: false, error });
    expect(assignRoleToUser).not.toHaveBeenCalled();
  });

  it("assigns the explicit roleId when provided, without resolving the default role", async () => {
    approveUserRegistration.mockResolvedValue({ success: true, data: undefined });
    assignRoleToUser.mockResolvedValue({ success: true, data: undefined });

    const { approveRegistration } = await import("./service");
    const result = await approveRegistration({ userId: "user-1", roleId: "role-editor", actor: { id: "admin-1" } });

    expect(findRoleIdByKey).not.toHaveBeenCalled();
    expect(assignRoleToUser).toHaveBeenCalledWith({ userId: "user-1", roleId: "role-editor", actor: { id: "admin-1" } });
    expect(result).toEqual({ success: true, data: undefined });
  });

  it("resolves the default role when roleId is not provided", async () => {
    approveUserRegistration.mockResolvedValue({ success: true, data: undefined });
    findRoleIdByKey.mockResolvedValue("role-member");
    assignRoleToUser.mockResolvedValue({ success: true, data: undefined });

    const { approveRegistration } = await import("./service");
    const result = await approveRegistration({ userId: "user-1", actor: { id: "admin-1" } });

    expect(findRoleIdByKey).toHaveBeenCalledWith("member");
    expect(assignRoleToUser).toHaveBeenCalledWith({ userId: "user-1", roleId: "role-member", actor: { id: "admin-1" } });
    expect(result).toEqual({ success: true, data: undefined });
  });

  it("uses the roleKey chosen in settings when roleId is not provided", async () => {
    approveUserRegistration.mockResolvedValue({ success: true, data: undefined });
    findRoleIdByKey.mockResolvedValue("role-author");
    assignRoleToUser.mockResolvedValue({ success: true, data: undefined });

    const { approveRegistration } = await import("./service");
    await approveRegistration({ userId: "user-1", roleKey: "author", actor: { id: "admin-1" } });

    expect(findRoleIdByKey).toHaveBeenCalledWith("author");
    expect(assignRoleToUser).toHaveBeenCalledWith({ userId: "user-1", roleId: "role-author", actor: { id: "admin-1" } });
  });

  it("refuses superadmin as default role without approving the account", async () => {
    const { approveRegistration } = await import("./service");
    const result = await approveRegistration({ userId: "user-1", roleKey: "superadmin", actor: { id: "admin-1" } });

    expect(result).toMatchObject({ success: false, error: { code: "rbac.roles.default_role_forbidden" } });
    expect(approveUserRegistration).not.toHaveBeenCalled();
    expect(assignRoleToUser).not.toHaveBeenCalled();
  });

  it("fails when the default role cannot be resolved, without approving the account", async () => {
    approveUserRegistration.mockResolvedValue({ success: true, data: undefined });
    findRoleIdByKey.mockResolvedValue(null);

    const { approveRegistration } = await import("./service");
    const result = await approveRegistration({ userId: "user-1", actor: { id: "admin-1" } });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.roles.not_found", message: expect.any(String) },
    });
    expect(approveUserRegistration).not.toHaveBeenCalled();
    expect(assignRoleToUser).not.toHaveBeenCalled();
  });
});
