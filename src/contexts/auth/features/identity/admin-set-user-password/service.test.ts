import { beforeEach, describe, expect, it, vi } from "vitest";

const incrementSessionVersion = vi.fn(async () => 1);
vi.mock("../../session/revoke-sessions/store", () => ({ incrementSessionVersion: (...args: unknown[]) => incrementSessionVersion(...(args as [])) }));

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

const writeUserPasswordHash = vi.fn();
vi.mock("./store", () => ({
  writeUserPasswordHash: (...args: unknown[]) => writeUserPasswordHash(...args),
}));

describe("adminSetUserPassword", () => {
  beforeEach(() => {
    recordAuditEvent.mockReset();
    hashPassword.mockReset();
    writeUserPasswordHash.mockReset();
    hashPassword.mockResolvedValue("scrypt$salt$hash");
  });

  it("hashes the password, writes it for the target user, and audits", async () => {
    writeUserPasswordHash.mockResolvedValue({ id: "target-1" });

    const { adminSetUserPassword } = await import("./service");
    const result = await adminSetUserPassword({
      actorId: "admin-1",
      targetUserId: "target-1",
      newPassword: "supersecret",
    });

    expect(hashPassword).toHaveBeenCalledWith("supersecret");
    expect(writeUserPasswordHash).toHaveBeenCalledWith("target-1", "scrypt$salt$hash");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.admin-set-user-password", detail: { targetUserId: "target-1" } }),
    );
    expect(result).toEqual({ success: true, data: { id: "target-1" } });
  });

  it("rejects a password shorter than 8 characters without hashing or auditing", async () => {
    const { adminSetUserPassword } = await import("./service");
    const result = await adminSetUserPassword({
      actorId: "admin-1",
      targetUserId: "target-1",
      newPassword: "short",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.weak_password", message: expect.any(String) },
    });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(writeUserPasswordHash).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("fails when the target user does not exist", async () => {
    writeUserPasswordHash.mockResolvedValue(null);

    const { adminSetUserPassword } = await import("./service");
    const result = await adminSetUserPassword({
      actorId: "admin-1",
      targetUserId: "ghost",
      newPassword: "supersecret",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.user_not_found", message: expect.any(String) },
    });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
