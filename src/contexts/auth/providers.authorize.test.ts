import { beforeEach, describe, expect, it, vi } from "vitest";

const findUserByEmailHandler = vi.fn();
vi.mock("./features/identity/find-user-by-email/handler", () => ({
  findUserByEmailHandler: (...args: unknown[]) => findUserByEmailHandler(...args),
}));

const verifyPasswordHash = vi.fn();
vi.mock("./features/identity/password-hashing", () => ({
  verifyPasswordHash: (...args: unknown[]) => verifyPasswordHash(...args),
  hashPassword: vi.fn(),
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
    delete process.env.AUTH_ENABLE_DEV_CREDENTIALS;
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

  it("refuses a pending user even with a matching password (P9)", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: true, data: { ...APPROVED_USER, status: "pending" } });
    verifyPasswordHash.mockResolvedValue(true);

    const authorize = await getAuthorize();
    expect(await authorize({ username: "u@e.com", password: "secret" })).toBeNull();
  });

  it("does not fall through to dev credentials when the flag is unset", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: false, error: { code: "auth.users.not_found", message: "x" } });

    const authorize = await getAuthorize();
    expect(await authorize({ username: "nobody", password: "whatever" })).toBeNull();
  });

  it("falls through to dev credentials when enabled outside production", async () => {
    findUserByEmailHandler.mockResolvedValue({ success: false, error: { code: "auth.users.not_found", message: "x" } });
    process.env.AUTH_ENABLE_DEV_CREDENTIALS = "true";

    const authorize = await getAuthorize();
    const result = await authorize({ username: "dev", password: "whatever" });

    expect(result).toEqual({ id: "dev-dev", name: "dev", email: "dev@dev.local" });
  });
});
