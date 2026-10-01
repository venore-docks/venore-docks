import { beforeEach, describe, expect, it, vi } from "vitest";

const email = { isEnabled: vi.fn(() => true), send: vi.fn(async () => ({ sent: true, id: null })) };
vi.mock("@/infrastructure/email", () => ({ emailPort: email }));
const listUserIdsWithPermission = vi.fn(async () => ["a1", "a2"]);
vi.mock("@/contexts/rbac", () => ({ listUserIdsWithPermission: (...a: unknown[]) => listUserIdsWithPermission(...(a as [])) }));
const listApprovedUserContacts = vi.fn(async () => [{ id: "a1", email: "admin@x.com", name: "Admin" }]);
vi.mock("@/contexts/auth", () => ({ listApprovedUserContacts: (...a: unknown[]) => listApprovedUserContacts(...(a as [])) }));
vi.mock("@/platform/seo/site-origin", () => ({ getSiteOrigin: async () => "https://site.test" }));

describe("notifyPendingRegistration", () => {
  beforeEach(() => {
    email.isEnabled.mockReturnValue(true);
    email.send.mockClear();
  });

  it("e-mails every active approver with a link to the review screen", async () => {
    const { notifyPendingRegistration } = await import("./notify-pending-registration");
    expect(await notifyPendingRegistration({ email: "novo@x.com", name: "Novo" })).toBe(1);
    expect(listUserIdsWithPermission).toHaveBeenCalledWith("rbac.users.manage");
    const message = (email.send.mock.calls[0] as unknown as [{ to: string; text: string }])[0];
    expect(message.to).toBe("admin@x.com");
    expect(message.text).toContain("https://site.test/admin/community");
  });

  it("does nothing without an e-mail provider", async () => {
    email.isEnabled.mockReturnValue(false);
    const { notifyPendingRegistration } = await import("./notify-pending-registration");
    expect(await notifyPendingRegistration({ email: "x@x.com", name: null })).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
  });
});
