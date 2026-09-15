import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminPageData = vi.fn();

vi.mock("./get-admin-page-data", () => ({
  getAdminPageData: (...args: unknown[]) => getAdminPageData(...args),
}));

describe("getCommunityPageData", () => {
  beforeEach(() => {
    getAdminPageData.mockReset();
  });

  it("propagates the gate as-is when the base admin gate denies access", async () => {
    getAdminPageData.mockResolvedValue({ granted: false, reason: "unauthenticated" });

    const { getCommunityPageData } = await import("./get-community-page-data");
    const result = await getCommunityPageData();

    expect(result).toEqual({ granted: false, reason: "unauthenticated" });
  });

  it("grants access to a superadmin even without a dedicated permission", async () => {
    getAdminPageData.mockResolvedValue({
      granted: true,
      actor: { id: "user-1", name: null, email: null, isSuperadmin: true, permissions: [] },
    });

    const { getCommunityPageData } = await import("./get-community-page-data");
    const result = await getCommunityPageData();

    expect(result.granted).toBe(true);
  });

  it("grants access when the actor has rbac.users.manage", async () => {
    getAdminPageData.mockResolvedValue({
      granted: true,
      actor: { id: "user-1", name: null, email: null, isSuperadmin: false, permissions: ["rbac.users.manage"] },
    });

    const { getCommunityPageData } = await import("./get-community-page-data");
    const result = await getCommunityPageData();

    expect(result.granted).toBe(true);
  });

  it("grants access when the actor only has rbac.registrations.approve", async () => {
    getAdminPageData.mockResolvedValue({
      granted: true,
      actor: { id: "user-1", name: null, email: null, isSuperadmin: false, permissions: ["rbac.registrations.approve"] },
    });

    const { getCommunityPageData } = await import("./get-community-page-data");
    const result = await getCommunityPageData();

    expect(result.granted).toBe(true);
  });

  it("denies access as forbidden when the actor has neither permission", async () => {
    getAdminPageData.mockResolvedValue({
      granted: true,
      actor: { id: "user-1", name: null, email: null, isSuperadmin: false, permissions: ["platform.admin.access"] },
    });

    const { getCommunityPageData } = await import("./get-community-page-data");
    const result = await getCommunityPageData();

    expect(result).toEqual({ granted: false, reason: "forbidden" });
  });
});
