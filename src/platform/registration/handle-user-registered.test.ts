import { beforeEach, describe, expect, it, vi } from "vitest";

const provisionUser = vi.fn();
const activateUser = vi.fn();
vi.mock("@/contexts/auth", () => ({
  provisionUser: (...args: unknown[]) => provisionUser(...args),
  activateUser: (...args: unknown[]) => activateUser(...args),
}));

const grantDefaultRoleOnRegistration = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  grantDefaultRoleOnRegistration: (...args: unknown[]) => grantDefaultRoleOnRegistration(...args),
}));

const isApprovalRequired = vi.fn();
const ensureRegistrationSettingsRegistered = vi.fn();
vi.mock("./registration-settings", () => ({
  REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY: "auth.registration_approval_required",
  isApprovalRequired: () => isApprovalRequired(),
  ensureRegistrationSettingsRegistered: () => ensureRegistrationSettingsRegistered(),
}));

const registerPlugins = vi.fn();
vi.mock("@/platform/plugin-engine/register-plugins", () => ({
  registerPlugins: (...args: unknown[]) => registerPlugins(...args),
}));

describe("handleUserRegistered", () => {
  const user = { id: "user-1", email: "a@b.com", name: "A" };

  beforeEach(() => {
    for (const mock of [provisionUser, activateUser, grantDefaultRoleOnRegistration, isApprovalRequired, ensureRegistrationSettingsRegistered, registerPlugins]) {
      mock.mockReset();
    }
    registerPlugins.mockResolvedValue(undefined);
    ensureRegistrationSettingsRegistered.mockResolvedValue(undefined);
    provisionUser.mockResolvedValue({ success: true, data: undefined });
    activateUser.mockResolvedValue({ success: true, data: undefined });
    grantDefaultRoleOnRegistration.mockResolvedValue({ success: true, data: undefined });
  });

  it("keeps the account pending when approval is required", async () => {
    isApprovalRequired.mockResolvedValue(true);
    const { handleUserRegistered } = await import("./handle-user-registered");

    expect(await handleUserRegistered(user)).toEqual({ success: true, data: undefined });
    expect(provisionUser).toHaveBeenCalledWith(user);
    expect(activateUser).not.toHaveBeenCalled();
    expect(grantDefaultRoleOnRegistration).not.toHaveBeenCalled();
  });

  it("activates the account and grants the default role when approval is off", async () => {
    isApprovalRequired.mockResolvedValue(false);
    const { handleUserRegistered } = await import("./handle-user-registered");

    expect(await handleUserRegistered(user)).toEqual({ success: true, data: undefined });
    expect(activateUser).toHaveBeenCalledWith({ userId: "user-1", reason: "registration-auto-approval" });
    expect(grantDefaultRoleOnRegistration).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("does not grant a role when activation fails (the account stays pending)", async () => {
    isApprovalRequired.mockResolvedValue(false);
    const error = { code: "auth.identity.user_not_found", message: "x" };
    activateUser.mockResolvedValue({ success: false, error });
    const { handleUserRegistered } = await import("./handle-user-registered");

    expect(await handleUserRegistered(user)).toEqual({ success: false, error });
    expect(grantDefaultRoleOnRegistration).not.toHaveBeenCalled();
  });

  it("never grants superadmin, even with no superadmin in the system", async () => {
    isApprovalRequired.mockResolvedValue(true);
    const { handleUserRegistered } = await import("./handle-user-registered");
    await handleUserRegistered(user);
    expect(provisionUser).toHaveBeenCalled();
  });
});
