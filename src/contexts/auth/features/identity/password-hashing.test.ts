import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPasswordHash } from "./password-hashing";

describe("password hashing", () => {
  it("round-trips with the current parameters", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt2$32768$8$3$")).toBe(true);
    expect(await verifyPasswordHash("correct horse battery", hash)).toBe(true);
    expect(await verifyPasswordHash("wrong", hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it("still verifies the legacy format and flags it for rehash", async () => {
    const salt = randomBytes(16);
    const legacy = `scrypt$${salt.toString("base64")}$${scryptSync("senha-antiga", salt, 64).toString("base64")}`;
    expect(await verifyPasswordHash("senha-antiga", legacy)).toBe(true);
    expect(needsRehash(legacy)).toBe(true);
  });

  it("rejects malformed or tampered hashes without throwing", async () => {
    expect(await verifyPasswordHash("x", "garbage")).toBe(false);
    expect(await verifyPasswordHash("x", "scrypt2$99999999$8$1$AAAA$BBBB")).toBe(false);
  });
});
