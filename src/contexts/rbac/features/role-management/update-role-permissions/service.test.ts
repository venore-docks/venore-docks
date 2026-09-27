import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

const findRoleById = vi.fn();
const findUserIdsWithRole = vi.fn();
const replaceRolePermissions = vi.fn();
const findRolePermissionKeys = vi.fn();

vi.mock("./store", () => ({
  findRoleById: (...args: unknown[]) => findRoleById(...args),
  findUserIdsWithRole: (...args: unknown[]) => findUserIdsWithRole(...args),
  replaceRolePermissions: (...args: unknown[]) => replaceRolePermissions(...args),
  findRolePermissionKeys: (...args: unknown[]) => findRolePermissionKeys(...args),
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

describe("updateRolePermissions", () => {
  beforeEach(() => {
    assertActorCanManageUserRoles.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorHoldsPermissions.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorIsSuperadmin.mockReset().mockResolvedValue({ success: true, data: undefined });
    findRoleById.mockReset();
    findUserIdsWithRole.mockReset();
    replaceRolePermissions.mockReset();
    findRolePermissionKeys.mockReset().mockResolvedValue(["cms.entries.manage"]);
    invalidateUserContext.mockReset();
  });

  it("fails when the role does not exist", async () => {
    findRoleById.mockResolvedValue(null);

    const { updateRolePermissions } = await import("./service");
    const result = await updateRolePermissions({
      roleId: "missing",
      permissionKeys: [],
      actor: { id: "actor-1" },
    });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.roles.not_found", message: expect.any(String) },
    });
    expect(replaceRolePermissions).not.toHaveBeenCalled();
    expect(invalidateUserContext).not.toHaveBeenCalled();
  });

  it("refuses to change permissions of the superadmin role", async () => {
    findRoleById.mockResolvedValue({ id: "role-1", key: "superadmin", name: "Super Admin", isSystem: true });

    const { updateRolePermissions } = await import("./service");
    const result = await updateRolePermissions({
      roleId: "role-1",
      permissionKeys: ["rbac.roles.manage"],
      actor: { id: "actor-1" },
    });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.roles.superadmin_immutable", message: expect.any(String) },
    });
    expect(replaceRolePermissions).not.toHaveBeenCalled();
    expect(invalidateUserContext).not.toHaveBeenCalled();
  });

  it("replaces permissions for a non-system role and invalidates every affected user's cached context", async () => {
    findRoleById.mockResolvedValue({ id: "role-1", key: "editor", name: "Editor", isSystem: false });
    replaceRolePermissions.mockResolvedValue({ id: "role-1", key: "editor", name: "Editor", isSystem: false });
    findUserIdsWithRole.mockResolvedValue(["user-1", "user-2"]);

    const { updateRolePermissions } = await import("./service");
    const result = await updateRolePermissions({
      roleId: "role-1",
      permissionKeys: ["cms.entries.manage"],
      actor: { id: "actor-1" },
    });

    expect(result.success).toBe(true);
    expect(replaceRolePermissions).toHaveBeenCalledWith("role-1", ["cms.entries.manage"]);
    expect(invalidateUserContext).toHaveBeenCalledTimes(1);
    expect(invalidateUserContext).toHaveBeenCalledWith(["user-1", "user-2"]);
  });

  it("only checks the ADDED keys against the actor's own permissions and refuses an escalation", async () => {
    findRoleById.mockResolvedValue({ id: "role-1", key: "editor", name: "Editor", isSystem: true });
    assertActorHoldsPermissions.mockResolvedValue({ success: false, error: { code: "rbac.roles.privilege_escalation", message: "nope" } });

    const { updateRolePermissions } = await import("./service");
    const result = await updateRolePermissions({
      roleId: "role-1",
      permissionKeys: ["cms.entries.manage", "media.purge"],
      actor: { id: "actor-1" },
    });

    expect(assertActorHoldsPermissions).toHaveBeenCalledWith("actor-1", ["media.purge"]);
    expect(result.success).toBe(false);
    expect(replaceRolePermissions).not.toHaveBeenCalled();
  });
});
