import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({ beginOperation: () => ({}), endOperation: () => undefined }));
const email = { isEnabled: vi.fn(() => true), send: vi.fn(async () => ({ sent: true, id: "m1" })) };
vi.mock("@/infrastructure/email", () => ({ emailPort: email }));
const findResettableUser = vi.fn();
const hasRecentResetToken = vi.fn();
const insertResetToken = vi.fn();
vi.mock("./store", () => ({
  findResettableUser: (...a: unknown[]) => findResettableUser(...a),
  hasRecentResetToken: (...a: unknown[]) => hasRecentResetToken(...a),
  insertResetToken: (...a: unknown[]) => insertResetToken(...a),
}));

const input = { email: "ana@example.com", resetUrl: "https://site.test/reset-password" };

describe("requestPasswordReset", () => {
  beforeEach(() => {
    email.isEnabled.mockReturnValue(true);
    email.send.mockClear();
    findResettableUser.mockReset().mockResolvedValue({ id: "u1", email: "ana@example.com", name: "Ana" });
    hasRecentResetToken.mockReset().mockResolvedValue(false);
    insertResetToken.mockReset();
  });

  it("stores only the token hash and e-mails the raw token in the link", async () => {
    const { requestPasswordReset } = await import("./service");
    expect(await requestPasswordReset(input)).toEqual({ success: true, data: { accepted: true } });

    const [, tokenHash, expiresAt] = insertResetToken.mock.calls[0] as [string, string, Date];
    const message = (email.send.mock.calls[0] as unknown as [{ text: string; to: string }])[0];
    const token = decodeURIComponent(message.text.match(/token=([^\s]+)/)![1]);
    expect(message.to).toBe("ana@example.com");
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("answers the same for an unknown account and sends nothing", async () => {
    findResettableUser.mockResolvedValue(null);
    const { requestPasswordReset } = await import("./service");
    expect(await requestPasswordReset(input)).toEqual({ success: true, data: { accepted: true } });
    expect(email.send).not.toHaveBeenCalled();
  });

  it("does not resend within the cooldown", async () => {
    hasRecentResetToken.mockResolvedValue(true);
    const { requestPasswordReset } = await import("./service");
    await requestPasswordReset(input);
    expect(insertResetToken).not.toHaveBeenCalled();
  });

  it("is unavailable without an e-mail provider", async () => {
    email.isEnabled.mockReturnValue(false);
    const { requestPasswordReset } = await import("./service");
    expect((await requestPasswordReset(input)).success).toBe(false);
  });
});
