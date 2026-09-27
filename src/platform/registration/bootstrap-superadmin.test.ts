import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const activateUser = vi.fn();
const getSessionIdentity = vi.fn();
const registerWithPassword = vi.fn();
vi.mock("@/contexts/auth", () => ({
  activateUser: (...args: unknown[]) => activateUser(...args),
  getSessionIdentity: (...args: unknown[]) => getSessionIdentity(...args),
  registerWithPassword: (...args: unknown[]) => registerWithPassword(...args),
}));

const grantSuperadmin = vi.fn();
const superadminExists = vi.fn();
vi.mock("@/contexts/rbac", () => ({
  grantSuperadmin: (...args: unknown[]) => grantSuperadmin(...args),
  superadminExists: (...args: unknown[]) => superadminExists(...args),
}));

const checkRateLimit = vi.fn();
vi.mock("@/infrastructure/rate-limit", () => ({ checkRateLimit: (...args: unknown[]) => checkRateLimit(...args) }));

const TOKEN = "s3cr3t-setup-token-123";

describe("bootstrapSuperadmin", () => {
  beforeEach(() => {
    for (const mock of [activateUser, getSessionIdentity, registerWithPassword, grantSuperadmin, superadminExists, checkRateLimit]) {
      mock.mockReset();
    }
    vi.stubEnv("SETUP_TOKEN", TOKEN);
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 });
    superadminExists.mockResolvedValue({ success: true, data: false });
    grantSuperadmin.mockResolvedValue({ success: true, data: undefined });
    activateUser.mockResolvedValue({ success: true, data: undefined });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("is disabled without a SETUP_TOKEN", async () => {
    vi.stubEnv("SETUP_TOKEN", "");
    const { bootstrapSuperadmin } = await import("./bootstrap-superadmin");
    const result = await bootstrapSuperadmin({ mode: "session", token: "x", clientIp: "1.1.1.1" });
    expect(result).toEqual({ success: false, error: { code: "setup.disabled", message: expect.any(String) } });
  });

  it("rejects a wrong token without touching rbac", async () => {
    const { bootstrapSuperadmin } = await import("./bootstrap-superadmin");
    const result = await bootstrapSuperadmin({ mode: "session", token: "wrong-token-value-xx", clientIp: "1.1.1.1" });
    expect(result.success).toBe(false);
    expect(grantSuperadmin).not.toHaveBeenCalled();
  });

  it("promotes the signed-in account (even pending) and activates it", async () => {
    getSessionIdentity.mockResolvedValue({ success: true, data: { id: "u1", email: "a@b.com", status: "pending" } });
    const { bootstrapSuperadmin } = await import("./bootstrap-superadmin");
    const result = await bootstrapSuperadmin({ mode: "session", token: TOKEN, clientIp: "1.1.1.1" });

    expect(result).toEqual({ success: true, data: { userId: "u1", created: false } });
    expect(grantSuperadmin).toHaveBeenCalledWith({ userId: "u1" });
    expect(activateUser).toHaveBeenCalledWith({ userId: "u1", reason: "bootstrap" });
  });

  it("creates the account in create mode", async () => {
    registerWithPassword.mockResolvedValue({ success: true, data: { id: "u2", email: "c@d.com", name: "C" } });
    const { bootstrapSuperadmin } = await import("./bootstrap-superadmin");
    const result = await bootstrapSuperadmin({
      mode: "create",
      token: TOKEN,
      clientIp: "1.1.1.1",
      name: "C",
      email: "c@d.com",
      password: "12345678",
    });
    expect(result).toEqual({ success: true, data: { userId: "u2", created: true } });
  });

  it("refuses once a superadmin exists", async () => {
    superadminExists.mockResolvedValue({ success: true, data: true });
    const { bootstrapSuperadmin } = await import("./bootstrap-superadmin");
    const result = await bootstrapSuperadmin({ mode: "session", token: TOKEN, clientIp: "1.1.1.1" });
    expect(result).toEqual({ success: false, error: { code: "setup.already_done", message: expect.any(String) } });
  });

  it("is rate limited per IP", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 });
    const { bootstrapSuperadmin } = await import("./bootstrap-superadmin");
    const result = await bootstrapSuperadmin({ mode: "session", token: TOKEN, clientIp: "1.1.1.1" });
    expect(result).toEqual({ success: false, error: { code: "setup.rate_limited", message: expect.any(String) } });
  });
});
