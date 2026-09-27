import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { base32Decode, base32Encode, buildOtpauthUri, matchTotp, totpAt } from "./totp";
import { openSecret, sealSecret } from "./secret-box";

// Vetor do RFC 6238 (SHA1, segredo ASCII "12345678901234567890"), truncado pra 6 dígitos.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it("accepts the adjacent step only, returning which step matched", () => {
    const now = 1111111109 * 1000;
    const step = Math.floor(1111111109 / 30);
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 2), now)).toBeNull();
    expect(matchTotp(RFC_SECRET, "abc", now)).toBeNull();
  });

  it("builds an otpauth URI the apps understand", () => {
    expect(buildOtpauthUri("ABC", "ana@x.com", "Meu Site")).toBe(
      "otpauth://totp/Meu%20Site%3Aana%40x.com?secret=ABC&issuer=Meu+Site&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("secret box", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "one"));
  afterEach(() => vi.unstubAllEnvs());

  it("encrypts with a random IV and only opens with the same AUTH_SECRET", () => {
    const sealed = sealSecret("JBSWY3DPEHPK3PXP");
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(sealSecret("JBSWY3DPEHPK3PXP")).not.toBe(sealed);
    expect(openSecret(sealed)).toBe("JBSWY3DPEHPK3PXP");
    vi.stubEnv("AUTH_SECRET", "two");
    expect(openSecret(sealed)).toBeNull();
  });
});
