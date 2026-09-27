import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/rbac", () => ({
  authorizeActor: vi.fn(),
  grantSuperadmin: vi.fn(),
  grantDefaultRoleOnRegistration: vi.fn(),
  ensureBaseRbacDataSeeded: vi.fn(),
  assignRoleToUser: vi.fn(),
}));

describe("@venore/plugin-sdk/rbac", () => {
  it("exposes authorization but none of the role-granting primitives", async () => {
    const sdk = (await import("./rbac")) as Record<string, unknown>;
    expect(typeof sdk.authorizeActor).toBe("function");
    for (const name of ["grantSuperadmin", "grantDefaultRoleOnRegistration", "ensureBaseRbacDataSeeded", "assignRoleToUser"]) {
      expect(sdk[name]).toBeUndefined();
    }
  });
});
