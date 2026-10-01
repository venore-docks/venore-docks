import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
const checkActorCanGrantRole = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: (...a: unknown[]) => authorizeActor(...a),
  checkActorCanGrantRole: (...a: unknown[]) => checkActorCanGrantRole(...a),
  assignRoleOnBehalfOf: vi.fn(),
  grantDefaultRoleOnRegistration: vi.fn(),
  listRoles: vi.fn(),
}));
const createInvitation = vi.fn();
vi.mock("@/contexts/auth", () => ({
  createInvitation: (...a: unknown[]) => createInvitation(...a),
  listApprovedUserContacts: async () => [{ id: "admin", email: "a@x.com", name: "Admin" }],
  getInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  listPendingInvitations: vi.fn(),
  revokeInvitation: vi.fn(),
}));
const email = { isEnabled: vi.fn(() => false), send: vi.fn(async () => ({ sent: true, id: null })) };
vi.mock("@/infrastructure/email", () => ({ emailPort: email }));
vi.mock("@/platform/brand/get-brand-config", () => ({ getBrandConfig: async () => ({ siteName: "Site" }) }));

const input = { email: "nova@x.com", roleId: "role-editor", origin: "https://site.test" };

describe("inviteUser", () => {
  beforeEach(() => {
    authorizeActor.mockReset().mockResolvedValue({ authorized: true, actorId: "admin" });
    checkActorCanGrantRole.mockReset().mockResolvedValue({ success: true, data: { id: "role-editor", key: "editor", name: "Editor" } });
    createInvitation.mockReset().mockResolvedValue({ success: true, data: { id: "i1", token: "tok", expiresAt: new Date() } });
  });

  it("needs rbac.users.manage and the right to grant that role", async () => {
    const { inviteUser } = await import("./invitations");
    authorizeActor.mockResolvedValueOnce({ authorized: false, error: { code: "rbac.authorization.forbidden", message: "no" } });
    expect((await inviteUser(input)).success).toBe(false);
    checkActorCanGrantRole.mockResolvedValueOnce({ success: false, error: { code: "rbac.roles.privilege_escalation", message: "no" } });
    expect((await inviteUser(input)).success).toBe(false);
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it("returns the link to copy when e-mail is not configured, and e-mails it when it is", async () => {
    const { inviteUser } = await import("./invitations");
    expect(await inviteUser(input)).toEqual({ success: true, data: expect.objectContaining({ link: "https://site.test/convite/tok", emailed: false }) });
    email.isEnabled.mockReturnValue(true);
    expect(await inviteUser(input)).toEqual({ success: true, data: expect.objectContaining({ emailed: true }) });
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: "nova@x.com" }));
  });
});
