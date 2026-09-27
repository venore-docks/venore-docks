import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSessionVersion, verifySessionVersionProof } from "./session-version-proof";

describe("session version proof", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "test-secret"));
  afterEach(() => vi.unstubAllEnvs());

  it("only accepts a proof signed for that user and that version", () => {
    const proof = signSessionVersion("u1", 4);
    expect(verifySessionVersionProof("u1", 4, proof)).toBe(true);
    expect(verifySessionVersionProof("u1", 5, proof)).toBe(false);
    expect(verifySessionVersionProof("u2", 4, proof)).toBe(false);
  });

  it("rejects a missing or forged proof (client-side session update)", () => {
    expect(verifySessionVersionProof("u1", 4, undefined)).toBe(false);
    expect(verifySessionVersionProof("u1", 4, "forged")).toBe(false);
  });
});
