import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

const findRoleById = vi.fn();
const findUserIdsWithRole = vi.fn();
const updateRoleName = vi.fn();

vi.mock("./store", () => ({
  findRoleById: (...args: unknown[]) => findRoleById(...args),
  findUserIdsWithRole: (...args: unknown[]) => findUserIdsWithRole(...args),
  updateRoleName: (...args: unknown[]) => updateRoleName(...args),
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

describe("renameRole", () => {
  beforeEach(() => {
    assertActorCanManageUserRoles.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorHoldsPermissions.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorIsSuperadmin.mockReset().mockResolvedValue({ success: true, data: undefined });
    findRoleById.mockReset();
    findUserIdsWithRole.mockReset();
    updateRoleName.mockReset();
    invalidateUserContext.mockReset();
  });

  it("fails when the role does not exist", async () => {
    findRoleById.mockResolvedValue(null);

    const { renameRole } = await import("./service");
    const result = await renameRole({ roleId: "missing", name: "Overlord", actor: { id: "actor-1" } });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.roles.not_found", message: expect.any(String) },
    });
    expect(updateRoleName).not.toHaveBeenCalled();
    expect(invalidateUserContext).not.toHaveBeenCalled();
  });

  it("renames a system role's display name and invalidates every affected user's cached context", async () => {
    findRoleById.mockResolvedValue({ id: "role-1", key: "superadmin", name: "Super Admin", isSystem: true });
    updateRoleName.mockResolvedValue({ id: "role-1", key: "superadmin", name: "Overlord", isSystem: true });
    findUserIdsWithRole.mockResolvedValue(["user-1", "user-2"]);

    const { renameRole } = await import("./service");
    const result = await renameRole({ roleId: "role-1", name: "Overlord", actor: { id: "actor-1" } });

    expect(result).toEqual({
      success: true,
      data: { id: "role-1", key: "superadmin", name: "Overlord", isSystem: true },
    });
    expect(updateRoleName).toHaveBeenCalledWith("role-1", "Overlord");
    expect(invalidateUserContext).toHaveBeenCalledTimes(1);
    expect(invalidateUserContext).toHaveBeenCalledWith(["user-1", "user-2"]);
  });

  it("renames a custom role's display name", async () => {
    findRoleById.mockResolvedValue({ id: "role-2", key: "editor", name: "Editor", isSystem: false });
    updateRoleName.mockResolvedValue({ id: "role-2", key: "editor", name: "Editor de conteúdo", isSystem: false });
    findUserIdsWithRole.mockResolvedValue([]);

    const { renameRole } = await import("./service");
    const result = await renameRole({ roleId: "role-2", name: "Editor de conteúdo", actor: { id: "actor-1" } });

    expect(result.success).toBe(true);
    expect(updateRoleName).toHaveBeenCalledWith("role-2", "Editor de conteúdo");
    expect(invalidateUserContext).toHaveBeenCalledWith([]);
  });
});
