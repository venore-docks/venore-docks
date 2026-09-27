import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

const findRoleByKey = vi.fn();
const insertRoleWithPermissions = vi.fn();

vi.mock("./store", () => ({
  findRoleByKey: (...args: unknown[]) => findRoleByKey(...args),
  insertRoleWithPermissions: (...args: unknown[]) => insertRoleWithPermissions(...args),
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

describe("createCustomRole", () => {
  beforeEach(() => {
    assertActorCanManageUserRoles.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorHoldsPermissions.mockReset().mockResolvedValue({ success: true, data: undefined });
    assertActorIsSuperadmin.mockReset().mockResolvedValue({ success: true, data: undefined });
    findRoleByKey.mockReset();
    insertRoleWithPermissions.mockReset();
  });

  it("creates a role when the key is not taken", async () => {
    findRoleByKey.mockResolvedValue(null);
    insertRoleWithPermissions.mockResolvedValue({
      id: "role-1",
      key: "editor",
      name: "Editor",
      isSystem: false,
    });

    const { createCustomRole } = await import("./service");
    const result = await createCustomRole({
      key: "editor",
      name: "Editor",
      permissionKeys: ["cms.entries.manage"],
      actor: { id: "actor-1" },
    });

    expect(result).toEqual({
      success: true,
      data: { id: "role-1", key: "editor", name: "Editor", isSystem: false },
    });
    expect(insertRoleWithPermissions).toHaveBeenCalledWith({
      key: "editor",
      name: "Editor",
      permissionKeys: ["cms.entries.manage"],
    });
  });

  it("fails when the key is already taken", async () => {
    findRoleByKey.mockResolvedValue({ id: "role-1", key: "editor", name: "Editor", isSystem: false });

    const { createCustomRole } = await import("./service");
    const result = await createCustomRole({
      key: "editor",
      name: "Editor 2",
      permissionKeys: [],
      actor: { id: "actor-1" },
    });

    expect(result).toEqual({
      success: false,
      error: { code: "rbac.roles.key_taken", message: expect.any(String) },
    });
    expect(insertRoleWithPermissions).not.toHaveBeenCalled();
  });

  it("refuses a role carrying permissions the actor does not hold", async () => {
    assertActorHoldsPermissions.mockResolvedValue({ success: false, error: { code: "rbac.roles.privilege_escalation", message: "nope" } });

    const { createCustomRole } = await import("./service");
    const result = await createCustomRole({ key: "purger", name: "Purger", permissionKeys: ["media.purge"], actor: { id: "actor-1" } });

    expect(result.success).toBe(false);
  });
});
