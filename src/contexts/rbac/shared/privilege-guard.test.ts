import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserContext = vi.fn();
vi.mock("../features/role-assignment/get-user-context/service", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
}));

function context(userId: string, permissions: string[], isSuperadmin = false) {
  return { success: true, data: { userId, roles: [], permissions, isSuperadmin, scopedPermissions: {} } };
}

describe("privilege guard", () => {
  beforeEach(() => {
    getUserContext.mockReset();
  });

  it("lets a non-superadmin grant only permissions they already hold", async () => {
    getUserContext.mockResolvedValue(context("admin-1", ["cms.entries.manage", "rbac.roles.manage"]));
    const { assertActorHoldsPermissions } = await import("./privilege-guard");

    expect(await assertActorHoldsPermissions("admin-1", ["cms.entries.manage"])).toEqual({ success: true, data: undefined });
    const denied = await assertActorHoldsPermissions("admin-1", ["cms.entries.manage", "media.purge"]);
    expect(denied).toEqual({
      success: false,
      error: { code: "rbac.roles.privilege_escalation", message: expect.stringContaining("media.purge") },
    });
  });

  it("lets a superadmin grant anything", async () => {
    getUserContext.mockResolvedValue(context("root", [], true));
    const { assertActorHoldsPermissions } = await import("./privilege-guard");
    expect(await assertActorHoldsPermissions("root", ["media.purge"])).toEqual({ success: true, data: undefined });
  });

  it("refuses the superadmin role and superadmin targets to a non-superadmin", async () => {
    getUserContext.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === "root" ? context("root", [], true) : context(userId, ["rbac.roles.assign"]),
    );
    const { assertActorCanManageUserRoles } = await import("./privilege-guard");

    expect((await assertActorCanManageUserRoles("admin-1", "admin-1", "superadmin")).success).toBe(false);
    expect((await assertActorCanManageUserRoles("admin-1", "root", "admin")).success).toBe(false);
    expect((await assertActorCanManageUserRoles("admin-1", "member-1", "editor")).success).toBe(true);
    expect((await assertActorCanManageUserRoles("root", "member-1", "superadmin")).success).toBe(true);
  });
});
