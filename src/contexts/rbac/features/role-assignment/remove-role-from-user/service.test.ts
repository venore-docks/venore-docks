import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

const deleteUserRole = vi.fn();
const findRoleById = vi.fn();
const findUserIdsWithRole = vi.fn();

vi.mock("./store", () => ({
  deleteUserRole: (...args: unknown[]) => deleteUserRole(...args),
  findRoleById: (...args: unknown[]) => findRoleById(...args),
  findUserIdsWithRole: (...args: unknown[]) => findUserIdsWithRole(...args),
}));

const invalidateUserContext = vi.fn();

vi.mock("../../../user-context-cache", () => ({
  invalidateUserContext: (...args: unknown[]) => invalidateUserContext(...args),
}));


const assertActorCanManageUserRoles = vi.fn();
const assertActorHoldsPermissions = vi.fn();
const assertActorIsSuperadmin = vi.fn();
vi.mock("../../../shared/privilege-guard", () => ({
  SUPERADMIN_ROLE_KEY: "superadmin",
  assertActorCanManageUserRoles: (...args: unknown[]) => assertActorCanManageUserRoles(...args),
  assertActorHoldsPermissions: (...args: unknown[]) => assertActorHoldsPermissions(...args),
  assertActorIsSuperadmin: (...args: unknown[]) => assertActorIsSuperadmin(...args),
}));

describe("removeRoleFromUser", () => {
  beforeEach(() => {
    assertActorCanManageUserRoles.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorHoldsPermissions.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorIsSuperadmin.mockReset().mockResolvedValue({ success: true, data: undefined });
    deleteUserRole.mockReset();
    deleteUserRole.mockResolvedValue(undefined);
    findRoleById.mockReset();
    findRoleById.mockResolvedValue(null);
    findUserIdsWithRole.mockReset();
    invalidateUserContext.mockReset();
  });

  it("removes the assignment and invalidates the actor's cached context", async () => {
    const { removeRoleFromUser } = await import("./service");
    const result = await removeRoleFromUser({ userId: "user-1", roleId: "role-1", actor: { id: "actor-1" } });

    expect(result).toEqual({ success: true, data: undefined });
    expect(deleteUserRole).toHaveBeenCalledWith("user-1", "role-1");
    expect(invalidateUserContext).toHaveBeenCalledWith("user-1");
  });

  it("is idempotent when the role was never assigned", async () => {
    const { removeRoleFromUser } = await import("./service");
    const result = await removeRoleFromUser({ userId: "user-1", roleId: "never-assigned", actor: { id: "actor-1" } });

    expect(result).toEqual({ success: true, data: undefined });
  });

  it("refuses to remove superadmin from the last user who has it, even when the actor removes themselves", async () => {
    findRoleById.mockResolvedValue({ id: "role-superadmin", key: "superadmin", name: "Superadmin", isSystem: true });
    findUserIdsWithRole.mockResolvedValue(["user-1"]);

    const { removeRoleFromUser } = await import("./service");
    const result = await removeRoleFromUser({ userId: "user-1", roleId: "role-superadmin", actor: { id: "user-1" } });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.roles.cannot_remove_last_superadmin", message: expect.any(String) },
    });
    expect(deleteUserRole).not.toHaveBeenCalled();
    expect(invalidateUserContext).not.toHaveBeenCalled();
  });

  it("allows removing superadmin from a user when another user still has the role", async () => {
    findRoleById.mockResolvedValue({ id: "role-superadmin", key: "superadmin", name: "Superadmin", isSystem: true });
    findUserIdsWithRole.mockResolvedValue(["user-1", "user-2"]);

    const { removeRoleFromUser } = await import("./service");
    const result = await removeRoleFromUser({ userId: "user-1", roleId: "role-superadmin", actor: { id: "user-2" } });

    expect(result).toEqual({ success: true, data: undefined });
    expect(deleteUserRole).toHaveBeenCalledWith("user-1", "role-superadmin");
    expect(invalidateUserContext).toHaveBeenCalledWith("user-1");
  });
});
