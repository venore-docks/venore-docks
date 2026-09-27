import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCspHeaders, resolveCspMode } from "./content-security-policy";

describe("content security policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to report-only and always enforces the anti-framing baseline", () => {
    expect(resolveCspMode(undefined)).toBe("report-only");
    const headers = buildCspHeaders("abc", "report-only", false);
    expect(headers.response["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
    expect(headers.response["Content-Security-Policy-Report-Only"]).toContain("'nonce-abc'");
    expect(headers.request["content-security-policy"]).toBeUndefined();
    expect(headers.request["content-security-policy-report-only"]).toContain("'nonce-abc'");
  });

  it("enforces the full policy in enforce mode", () => {
    const headers = buildCspHeaders("abc", "enforce", false);
    expect(headers.response["Content-Security-Policy"]).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(headers.response["Content-Security-Policy"]).not.toContain("unsafe-eval");
  });

  it("accepts a custom frame-ancestors list but not an injected directive", () => {
    vi.stubEnv("FRAME_ANCESTORS", "'self' https://intranet.example.com");
    expect(buildCspHeaders("n", "off", false).response["Content-Security-Policy"]).toContain(
      "frame-ancestors 'self' https://intranet.example.com",
    );
    vi.stubEnv("FRAME_ANCESTORS", "* ; script-src *");
    expect(buildCspHeaders("n", "off", false).response["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
  });
});
