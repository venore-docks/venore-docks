import { beforeEach, describe, expect, it, vi } from "vitest";

const incrementSessionVersion = vi.fn(async () => 1);
vi.mock("../../session/revoke-sessions/store", () => ({ incrementSessionVersion: (...args: unknown[]) => incrementSessionVersion(...(args as [])) }));

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1" })),
  endOperation: vi.fn(),
}));

const hashPassword = vi.fn();
const verifyPasswordHash = vi.fn();
vi.mock("../password-hashing", () => ({
  hashPassword: (...args: unknown[]) => hashPassword(...args),
  verifyPasswordHash: (...args: unknown[]) => verifyPasswordHash(...args),
}));

const writeOwnPasswordHash = vi.fn();
const findOwnPasswordHash = vi.fn();
vi.mock("./store", () => ({
  writeOwnPasswordHash: (...args: unknown[]) => writeOwnPasswordHash(...args),
  findOwnPasswordHash: (...args: unknown[]) => findOwnPasswordHash(...args),
}));

describe("setOwnPassword", () => {
  beforeEach(() => {
    hashPassword.mockReset();
    writeOwnPasswordHash.mockReset();
    hashPassword.mockResolvedValue("scrypt$salt$hash");
    findOwnPasswordHash.mockReset().mockResolvedValue(null);
    verifyPasswordHash.mockReset().mockResolvedValue(false);
    incrementSessionVersion.mockClear();
  });

  it("requires the current password when the account already has one, and ends other sessions on success", async () => {
    findOwnPasswordHash.mockResolvedValue("scrypt2$old");
    writeOwnPasswordHash.mockResolvedValue({ id: "user-1" });
    const { setOwnPassword } = await import("./service");

    const wrong = await setOwnPassword({ actorId: "user-1", newPassword: "supersecret", currentPassword: "nope" });
    expect(wrong).toEqual({ success: false, error: { code: "auth.identity.wrong_current_password", message: expect.any(String) } });
    expect(writeOwnPasswordHash).not.toHaveBeenCalled();

    verifyPasswordHash.mockResolvedValue(true);
    const right = await setOwnPassword({ actorId: "user-1", newPassword: "supersecret", currentPassword: "old" });
    expect(right.success).toBe(true);
    expect(incrementSessionVersion).toHaveBeenCalledWith("user-1");
  });

  it("hashes the password and writes it for the actor", async () => {
    writeOwnPasswordHash.mockResolvedValue({ id: "user-1" });

    const { setOwnPassword } = await import("./service");
    const result = await setOwnPassword({ actorId: "user-1", newPassword: "supersecret" });

    expect(hashPassword).toHaveBeenCalledWith("supersecret");
    expect(writeOwnPasswordHash).toHaveBeenCalledWith("user-1", "scrypt$salt$hash");
    expect(result).toEqual({ success: true, data: { id: "user-1" } });
  });

  it("rejects a password shorter than 8 characters without hashing", async () => {
    const { setOwnPassword } = await import("./service");
    const result = await setOwnPassword({ actorId: "user-1", newPassword: "short" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.weak_password", message: expect.any(String) },
    });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(writeOwnPasswordHash).not.toHaveBeenCalled();
  });

  it("fails when the user row does not exist", async () => {
    writeOwnPasswordHash.mockResolvedValue(null);

    const { setOwnPassword } = await import("./service");
    const result = await setOwnPassword({ actorId: "ghost", newPassword: "supersecret" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.identity.user_not_found", message: expect.any(String) },
    });
  });
});
