import { beforeEach, describe, expect, it, vi } from "vitest";

const findUserByEmailHandler = vi.fn();
vi.mock("./features/identity/find-user-by-email/handler", () => ({
  findUserByEmailHandler: (...args: unknown[]) => findUserByEmailHandler(...args),
}));

const verifyPasswordHash = vi.fn();
const burnPasswordVerificationTime = vi.fn();
vi.mock("./features/identity/password-hashing", () => ({
  verifyPasswordHash: (...args: unknown[]) => verifyPasswordHash(...args),
  burnPasswordVerificationTime: (...args: unknown[]) => burnPasswordVerificationTime(...args),
  hashPassword: vi.fn(),
}));

const rehashPasswordHandler = vi.fn();
vi.mock("./features/identity/rehash-password/handler", () => ({
  rehashPasswordHandler: (...args: unknown[]) => rehashPasswordHandler(...args),
}));

const isMfaEnabled = vi.fn(async () => false);
const verifyMfaCode = vi.fn(async () => false);
vi.mock("./features/mfa/verify-mfa-login/service", () => ({
  isMfaEnabled: (...args: unknown[]) => isMfaEnabled(...(args as [])),
  verifyMfaCode: (...args: unknown[]) => verifyMfaCode(...(args as [])),
}));

type AuthorizeFn = (credentials: Record<string, unknown>) => Promise<{ id: string; name?: string | null; email?: string | null } | null>;

async function getAuthorize(): Promise<AuthorizeFn> {
  const { buildAuthProviders } = await import("./providers");
  // O `Credentials()` do @auth/core guarda o config original (com o nosso authorize) em `.options`;
  // o `authorize` do nível de cima é só um stub `() => null` até a normalização em runtime.
  const provider = buildAuthProviders().find((p) => p.id === "credentials") as unknown as {
    options: { authorize: AuthorizeFn };
  };
  return provider.options.authorize;
}

const APPROVED_USER = {
  id: "u1",
  name: "U",
  email: "u@e.com",
  image: null,
  avatarMediaId: null,
  passwordHash: "scrypt$c2FsdA==$aGFzaA==",
  status: "approved" as const,
};

describe("credentials provider authorize", () => {
  beforeEach(() => {
    findUserByEmailHandler.mockReset();
    verifyPasswordHash.mockReset();
    burnPasswordVerificationTime.mockReset();
    rehashPasswordHandler.mockReset().mockResolvedValue({ success: true, data: { rehashed: false } });
    delete process.env.AUTH_DISABLE_CREDENTIALS;
  });

  it("returns null when username or password is missing", async () => {
    const authorize = await getAuthorize();

    expect(await authorize({ username: "", password: "" })).toBeNull();
    expect(await authorize({ username: "u@e.com", password: "" })).toBeNull();
    expect(findUserByEmailHandler).not.toHaveBeenCalled();
  });

  it("authenticates an approved user with a matching password", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: true, data: APPROVED_USER });
    verifyPasswordHash.mockResolvedValue(true);

    const authorize = await getAuthorize();
    const result = await authorize({ username: "u@e.com", password: "secret" });

    expect(findUserByEmailHandler).toHaveBeenCalledWith({ email: "u@e.com" });
    expect(result).toEqual({ id: "u1", name: "U", email: "u@e.com" });
  });

  it("normalizes the username to lowercase before the lookup (email is always stored lowercase)", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: true, data: APPROVED_USER });
    verifyPasswordHash.mockResolvedValue(true);

    const authorize = await getAuthorize();
    await authorize({ username: "U@E.com", password: "secret" });

    expect(findUserByEmailHandler).toHaveBeenCalledWith({ email: "u@e.com" });
  });

  it("returns null when the password does not match", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: true, data: APPROVED_USER });
    verifyPasswordHash.mockResolvedValue(false);

    const authorize = await getAuthorize();
    expect(await authorize({ username: "u@e.com", password: "wrong" })).toBeNull();
  });

  it("refuses a pending user only after the password matched, with a status-specific code (P9)", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: true, data: { ...APPROVED_USER, status: "frozen" } });
    verifyPasswordHash.mockResolvedValue(true);

    const authorize = await getAuthorize();
    await expect(authorize({ username: "u@e.com", password: "secret" })).rejects.toMatchObject({ code: "account_frozen" });
  });

  it("does not reveal the status of an account when the password is wrong", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: true, data: { ...APPROVED_USER, status: "frozen" } });
    verifyPasswordHash.mockResolvedValue(false);

    const authorize = await getAuthorize();
    expect(await authorize({ username: "u@e.com", password: "wrong" })).toBeNull();
  });

  it("burns the same verification time when the email does not exist", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: false, error: { code: "auth.users.not_found", message: "x" } });

    const authorize = await getAuthorize();
    expect(await authorize({ username: "nobody@e.com", password: "whatever" })).toBeNull();
    expect(burnPasswordVerificationTime).toHaveBeenCalledWith("whatever");
  });

  it("rehashes the stored password after a successful login", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: true, data: APPROVED_USER });
    verifyPasswordHash.mockResolvedValue(true);

    const authorize = await getAuthorize();
    await authorize({ username: "u@e.com", password: "secret" });
    expect(rehashPasswordHandler).toHaveBeenCalledWith({ userId: "u1", password: "secret", storedHash: APPROVED_USER.passwordHash });
  });

  it("asks for the second factor only after the right password, and checks it", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: true, data: APPROVED_USER });
    verifyPasswordHash.mockResolvedValue(true);
    isMfaEnabled.mockResolvedValue(true);
    const authorize = await getAuthorize();

    await expect(authorize({ username: "u@e.com", password: "right" })).rejects.toMatchObject({ code: "mfa_required" });
    verifyMfaCode.mockResolvedValue(false);
    await expect(authorize({ username: "u@e.com", password: "right", otp: "000000" })).rejects.toMatchObject({ code: "mfa_invalid" });
    verifyMfaCode.mockResolvedValue(true);
    await expect(authorize({ username: "u@e.com", password: "right", otp: "123456" })).resolves.toMatchObject({ id: "u1" });

    verifyPasswordHash.mockResolvedValue(false);
    isMfaEnabled.mockClear();
    await expect(authorize({ username: "u@e.com", password: "wrong" })).resolves.toBeNull();
    expect(isMfaEnabled).not.toHaveBeenCalled();
    isMfaEnabled.mockResolvedValue(false);
  });
});
