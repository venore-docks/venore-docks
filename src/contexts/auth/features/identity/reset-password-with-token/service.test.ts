import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({ beginOperation: () => ({}), endOperation: () => undefined, recordAuditEvent: async () => undefined }));
vi.mock("../password-hashing", () => ({ hashPassword: async () => "scrypt2$new" }));
const incrementSessionVersion = vi.fn();
vi.mock("../../session/revoke-sessions/store", () => ({ incrementSessionVersion: (...a: unknown[]) => incrementSessionVersion(...a) }));
const consumeResetToken = vi.fn();
const findUserStatus = vi.fn();
const writePasswordHash = vi.fn();
const deleteResetTokensOfUser = vi.fn();
vi.mock("./store", () => ({
  consumeResetToken: (...a: unknown[]) => consumeResetToken(...a),
  findUserStatus: (...a: unknown[]) => findUserStatus(...a),
  writePasswordHash: (...a: unknown[]) => writePasswordHash(...a),
  deleteResetTokensOfUser: (...a: unknown[]) => deleteResetTokensOfUser(...a),
}));

describe("resetPasswordWithToken", () => {
  beforeEach(() => {
    consumeResetToken.mockReset();
    findUserStatus.mockReset().mockResolvedValue("approved");
    writePasswordHash.mockReset();
    deleteResetTokensOfUser.mockReset();
    incrementSessionVersion.mockReset();
  });

  it("sets the new password, burns every pending link and ends the old sessions", async () => {
    consumeResetToken.mockResolvedValue("u1");
    const { resetPasswordWithToken } = await import("./service");
    expect(await resetPasswordWithToken({ token: "t", newPassword: "nova-senha-123" })).toEqual({ success: true, data: { userId: "u1" } });
    expect(consumeResetToken).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/), expect.any(Date));
    expect(writePasswordHash).toHaveBeenCalledWith("u1", "scrypt2$new");
    expect(deleteResetTokensOfUser).toHaveBeenCalledWith("u1");
    expect(incrementSessionVersion).toHaveBeenCalledWith("u1");
  });

  it("refuses an invalid/expired/used token and a blocked account", async () => {
    const { resetPasswordWithToken } = await import("./service");
    consumeResetToken.mockResolvedValue(null);
    expect((await resetPasswordWithToken({ token: "t", newPassword: "nova-senha-123" })).success).toBe(false);
    consumeResetToken.mockResolvedValue("u1");
    findUserStatus.mockResolvedValue("frozen");
    expect((await resetPasswordWithToken({ token: "t", newPassword: "nova-senha-123" })).success).toBe(false);
    expect(writePasswordHash).not.toHaveBeenCalled();
  });

  it("validates the password before consuming the token", async () => {
    const { resetPasswordWithToken } = await import("./service");
    expect((await resetPasswordWithToken({ token: "t", newPassword: "curta" })).success).toBe(false);
    expect(consumeResetToken).not.toHaveBeenCalled();
  });
});
