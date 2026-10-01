import { beforeEach, describe, expect, it, vi } from "vitest";

const findOwnCredential = vi.fn();
vi.mock("./store", () => ({ findOwnCredential: (...a: unknown[]) => findOwnCredential(...a) }));
const verifyPasswordHash = vi.fn();
vi.mock("../password-hashing", () => ({ verifyPasswordHash: (...a: unknown[]) => verifyPasswordHash(...a) }));
const removeUser = vi.fn(async () => ({ success: true, data: { id: "u1" } }));
vi.mock("../remove-user/service", () => ({ removeUser: (...a: unknown[]) => removeUser(...(a as [])) }));

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    findOwnCredential.mockReset().mockResolvedValue({ email: "Ana@X.com", passwordHash: "scrypt2$h" });
    verifyPasswordHash.mockReset().mockResolvedValue(true);
    removeUser.mockClear();
  });

  it("anonymizes the account after the e-mail and password check", async () => {
    const { deleteOwnAccount } = await import("./service");
    expect((await deleteOwnAccount("u1", { confirmEmail: "ana@x.com", password: "p" })).success).toBe(true);
    expect(removeUser).toHaveBeenCalledWith({ actorId: "u1", targetUserId: "u1", reason: "self-service (LGPD)" });
  });

  it("refuses a wrong e-mail or password", async () => {
    const { deleteOwnAccount } = await import("./service");
    expect((await deleteOwnAccount("u1", { confirmEmail: "outra@x.com", password: "p" })).success).toBe(false);
    verifyPasswordHash.mockResolvedValue(false);
    expect((await deleteOwnAccount("u1", { confirmEmail: "ana@x.com", password: "errada" })).success).toBe(false);
    expect(removeUser).not.toHaveBeenCalled();
  });
});
