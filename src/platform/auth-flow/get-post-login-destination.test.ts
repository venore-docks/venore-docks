import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const getCurrentUserRegistrationStatus = vi.fn();

vi.mock("@/contexts/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
  getCurrentUserRegistrationStatus: (...args: unknown[]) => getCurrentUserRegistrationStatus(...args),
}));

const getUserContext = vi.fn();
const superadminExists = vi.fn();

vi.mock("@/contexts/rbac", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  superadminExists: (...args: unknown[]) => superadminExists(...args),
}));

describe("getPostLoginDestination", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUserRegistrationStatus.mockReset();
    getCurrentUserRegistrationStatus.mockResolvedValue({ success: true, data: null });
    getUserContext.mockReset();
    superadminExists.mockReset();
  });

  it("goes to /login when there is no authenticated user", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: null });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination()).toBe("/login");
    expect(superadminExists).not.toHaveBeenCalled();
  });

  it("goes to /setup when no superadmin exists yet", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "user-1" } });
    superadminExists.mockResolvedValue({ success: true, data: false });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination()).toBe("/setup");
    expect(getUserContext).not.toHaveBeenCalled();
  });

  it("goes to /pending-approval when the user's registration is pending", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "user-1" } });
    superadminExists.mockResolvedValue({ success: true, data: true });
    getCurrentUserRegistrationStatus.mockResolvedValue({ success: true, data: "pending" });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination()).toBe("/pending-approval");
    expect(getUserContext).not.toHaveBeenCalled();
  });

  it("goes to /admin when the user is superadmin", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "user-1" } });
    superadminExists.mockResolvedValue({ success: true, data: true });
    getUserContext.mockResolvedValue({ success: true, data: { isSuperadmin: true, permissions: [], roles: [] } });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination()).toBe("/admin");
  });

  it("goes to /admin when the user has platform.admin.access", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "user-1" } });
    superadminExists.mockResolvedValue({ success: true, data: true });
    getUserContext.mockResolvedValue({
      success: true,
      data: { isSuperadmin: false, permissions: ["platform.admin.access"], roles: [] },
    });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination()).toBe("/admin");
  });

  it("goes to / for a regular user without admin access", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "user-1" } });
    superadminExists.mockResolvedValue({ success: true, data: true });
    getUserContext.mockResolvedValue({ success: true, data: { isSuperadmin: false, permissions: [], roles: [] } });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination()).toBe("/");
  });

  it("goes to / when the rbac context lookup fails", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "user-1" } });
    superadminExists.mockResolvedValue({ success: true, data: true });
    getUserContext.mockResolvedValue({ success: false, error: { code: "x", message: "x" } });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination()).toBe("/");
  });

  it("sends a pending OAuth user to /pending-approval even though getCurrentUser does not recognise them", async () => {
    getCurrentUserRegistrationStatus.mockResolvedValue({ success: true, data: "pending" });
    getCurrentUser.mockResolvedValue({ success: true, data: null });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination()).toBe("/pending-approval");
  });

  it("honours a safe callbackUrl and ignores an unsafe one", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "user-1" } });
    superadminExists.mockResolvedValue({ success: true, data: true });
    getUserContext.mockResolvedValue({ success: true, data: { isSuperadmin: false, permissions: [] } });

    const { getPostLoginDestination } = await import("./get-post-login-destination");
    expect(await getPostLoginDestination("/academy/curso")).toBe("/academy/curso");
    expect(await getPostLoginDestination("//evil.com")).toBe("/");
  });
});

