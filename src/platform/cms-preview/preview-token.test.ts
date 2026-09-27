import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPreviewToken, verifyPreviewToken } from "./preview-token";

describe("preview token", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "test-secret"));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips the entry id until it expires", () => {
    const { token } = createPreviewToken("entry-1", 24, 1_000);
    expect(verifyPreviewToken(token, 2_000)?.entryId).toBe("entry-1");
    expect(verifyPreviewToken(token, 1_000 + 25 * 3600 * 1000)).toBeNull();
  });

  it("rejects a token pointing at another entry or with a changed expiry", () => {
    const { token } = createPreviewToken("entry-1", 24, 1_000);
    const [, exp, sig] = token.split(".");
    expect(verifyPreviewToken(`${Buffer.from("entry-2").toString("base64url")}.${exp}.${sig}`, 2_000)).toBeNull();
    expect(verifyPreviewToken(`${token.split(".")[0]}.${Number(exp) + 1}.${sig}`, 2_000)).toBeNull();
    expect(verifyPreviewToken("lixo", 2_000)).toBeNull();
  });
});
