import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAuditEvent = vi.fn();
vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const hashPassword = vi.fn();
vi.mock("../password-hashing", () => ({
  hashPassword: (...args: unknown[]) => hashPassword(...args),
}));

const findUserIdByEmail = vi.fn();
const insertUser = vi.fn();
vi.mock("./store", () => ({
  findUserIdByEmail: (...args: unknown[]) => findUserIdByEmail(...args),
  insertUser: (...args: unknown[]) => insertUser(...args),
  isUniqueViolation: (error: unknown) =>
    typeof error === "object" && error !== null && (error as { code?: string }).code === "23505",
}));

describe("adminCreateUser", () => {
  beforeEach(() => {
    recordAuditEvent.mockReset();
    hashPassword.mockReset();
    findUserIdByEmail.mockReset();
    insertUser.mockReset();
    hashPassword.mockResolvedValue("scrypt$salt$hash");
    findUserIdByEmail.mockResolvedValue(null);
  });

  it("creates the user and audits", async () => {
    insertUser.mockResolvedValue({ id: "user-1", email: "new@example.com", name: "Novo" });

    const { adminCreateUser } = await import("./service");
    const result = await adminCreateUser({
      actorId: "admin-1",
      email: "New@Example.com",
      name: "Novo",
      password: "supersecret",
    });

    expect(findUserIdByEmail).toHaveBeenCalledWith("new@example.com");
    expect(insertUser).toHaveBeenCalledWith({ email: "new@example.com", name: "Novo", passwordHash: "scrypt$salt$hash" });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.admin-create-user", detail: { targetUserId: "user-1", email: "new@example.com" } }),
    );
    expect(result).toEqual({ success: true, data: { id: "user-1", email: "new@example.com", name: "Novo" } });
  });

  it("rejects an invalid email without hashing or auditing", async () => {
    const { adminCreateUser } = await import("./service");
    const result = await adminCreateUser({ actorId: "admin-1", email: "not-an-email", name: "Novo", password: "supersecret" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.invalid_email", message: expect.any(String) },
    });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(insertUser).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email without hashing or auditing", async () => {
    findUserIdByEmail.mockResolvedValue("existing-user");

    const { adminCreateUser } = await import("./service");
    const result = await adminCreateUser({ actorId: "admin-1", email: "taken@example.com", name: "Novo", password: "supersecret" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.email_taken", message: expect.any(String) },
    });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("translates a unique-violation race into email_taken", async () => {
    insertUser.mockRejectedValue({ code: "23505" });

    const { adminCreateUser } = await import("./service");
    const result = await adminCreateUser({ actorId: "admin-1", email: "new@example.com", name: "Novo", password: "supersecret" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.email_taken", message: expect.any(String) },
    });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
