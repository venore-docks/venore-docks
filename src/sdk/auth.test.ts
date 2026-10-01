import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/auth", () => ({
  findUserByEmail: async () => ({
    success: true,
    data: { id: "u1", email: "a@b.c", name: null, image: null, avatarMediaId: null, passwordHash: "scrypt2$secret", status: "approved" },
  }),
}));

describe("@venore/plugin-sdk/auth", () => {
  it("never hands the password hash to a plugin", async () => {
    const { findUserByEmail } = await import("./auth");
    const result = await findUserByEmail({ email: "a@b.c" });
    expect(result.success).toBe(true);
    expect(result.success && "passwordHash" in result.data).toBe(false);
  });

  it("does not expose system-only account primitives", async () => {
    const sdk = (await import("./auth")) as Record<string, unknown>;
    for (const name of ["activateUser", "provisionUser", "registerWithPassword", "signIn", "handlers", "purgeUser"]) {
      expect(sdk[name]).toBeUndefined();
    }
  });
});
