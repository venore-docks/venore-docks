import { beforeEach, describe, expect, it, vi } from "vitest";

const grantPermissionsToRoleByKey = vi.fn();
vi.mock("./store", () => ({ grantPermissionsToRoleByKey: (...args: unknown[]) => grantPermissionsToRoleByKey(...args) }));

const ensureBaseRbacDataSeeded = vi.fn();
vi.mock("../../../ensure-base-rbac-data", () => ({
  ensureBaseRbacDataSeeded: (...args: unknown[]) => ensureBaseRbacDataSeeded(...args),
}));

const invalidateUserContext = vi.fn();
vi.mock("../../../user-context-cache", () => ({
  invalidateUserContext: (...args: unknown[]) => invalidateUserContext(...args),
}));

const recordAuditEvent = vi.fn();
vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

describe("grantPermissionsToRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureBaseRbacDataSeeded.mockResolvedValue(undefined);
  });

  it("grants, invalidates every affected user's context and records an audit event", async () => {
    grantPermissionsToRoleByKey.mockResolvedValue({ roleFound: true, grantedCount: 2, affectedUserIds: ["u1", "u2"] });

    const { grantPermissionsToRole } = await import("./service");
    const result = await grantPermissionsToRole({
      roleKey: "admin",
      permissionKeys: ["academy.courses.manage", "academy.other"],
    });

    expect(result).toEqual({ success: true, data: { grantedCount: 2 } });
    expect(ensureBaseRbacDataSeeded).toHaveBeenCalled();
    expect(grantPermissionsToRoleByKey).toHaveBeenCalledWith("admin", ["academy.courses.manage", "academy.other"]);
    expect(invalidateUserContext).toHaveBeenCalledWith(["u1", "u2"]);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rbac.grant-permissions-to-role", outcome: "success" }),
    );
  });

  it("is an idempotent no-op success when nothing new is granted", async () => {
    grantPermissionsToRoleByKey.mockResolvedValue({ roleFound: true, grantedCount: 0, affectedUserIds: ["u1"] });

    const { grantPermissionsToRole } = await import("./service");
    const result = await grantPermissionsToRole({ roleKey: "admin", permissionKeys: ["academy.courses.manage"] });

    expect(result).toEqual({ success: true, data: { grantedCount: 0 } });
  });

  it("returns rbac.roles.not_found when the role key does not exist", async () => {
    grantPermissionsToRoleByKey.mockResolvedValue({ roleFound: false, grantedCount: 0, affectedUserIds: [] });

    const { grantPermissionsToRole } = await import("./service");
    const result = await grantPermissionsToRole({ roleKey: "ghost", permissionKeys: ["x.y"] });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("rbac.roles.not_found");
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect(invalidateUserContext).not.toHaveBeenCalled();
  });
});
