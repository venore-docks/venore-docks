import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

const findRoleWithPermissions = vi.fn();
const insertUserRole = vi.fn();

vi.mock("./store", () => ({
  findRoleWithPermissions: (...args: unknown[]) => findRoleWithPermissions(...args),
  insertUserRole: (...args: unknown[]) => insertUserRole(...args),
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

describe("assignRoleToUser", () => {
  beforeEach(() => {
    assertActorCanManageUserRoles.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorHoldsPermissions.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorIsSuperadmin.mockReset().mockResolvedValue({ success: true, data: undefined });
    findRoleWithPermissions.mockReset();
    insertUserRole.mockReset();
    invalidateUserContext.mockReset();
  });

  it("fails when the role does not exist", async () => {
    findRoleWithPermissions.mockResolvedValue(null);

    const { assignRoleToUser } = await import("./service");
    const result = await assignRoleToUser({ userId: "user-1", roleId: "missing", actor: { id: "actor-1" } });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.roles.not_found", message: expect.any(String) },
    });
    expect(insertUserRole).not.toHaveBeenCalled();
    expect(invalidateUserContext).not.toHaveBeenCalled();
  });

  it("assigns the role when it exists, idempotently, and invalidates the actor's cached context", async () => {
    findRoleWithPermissions.mockResolvedValue({ id: "role-1", key: "editor", permissionKeys: ["cms.entries.manage"] });
    insertUserRole.mockResolvedValue(undefined);

    const { assignRoleToUser } = await import("./service");
    const result = await assignRoleToUser({ userId: "user-1", roleId: "role-1", actor: { id: "actor-1" } });

    expect(result).toEqual({ success: true, data: undefined });
    expect(insertUserRole).toHaveBeenCalledWith("user-1", "role-1");
    expect(invalidateUserContext).toHaveBeenCalledWith("user-1");
  });

  it("refuses when the hierarchy guard denies (superadmin role or superadmin target)", async () => {
    findRoleWithPermissions.mockResolvedValue({ id: "role-sa", key: "superadmin", permissionKeys: [] });
    assertActorCanManageUserRoles.mockResolvedValue({ success: false, error: { code: "rbac.roles.superadmin_required", message: "x" } });

    const { assignRoleToUser } = await import("./service");
    const result = await assignRoleToUser({ userId: "actor-1", roleId: "role-sa", actor: { id: "actor-1" } });

    expect(assertActorCanManageUserRoles).toHaveBeenCalledWith("actor-1", "actor-1", "superadmin");
    expect(result).toEqual({ success: false, error: { code: "rbac.roles.superadmin_required", message: "x" } });
    expect(insertUserRole).not.toHaveBeenCalled();
  });

  it("refuses to hand out, via a role, permissions the actor does not hold", async () => {
    findRoleWithPermissions.mockResolvedValue({ id: "role-2", key: "media-purger", permissionKeys: ["media.purge"] });
    assertActorHoldsPermissions.mockResolvedValue({ success: false, error: { code: "rbac.roles.privilege_escalation", message: "nope" } });

    const { assignRoleToUser } = await import("./service");
    const result = await assignRoleToUser({ userId: "user-1", roleId: "role-2", actor: { id: "actor-1" } });

    expect(assertActorHoldsPermissions).toHaveBeenCalledWith("actor-1", ["media.purge"]);
    expect(result.success).toBe(false);
    expect(insertUserRole).not.toHaveBeenCalled();
  });
});
