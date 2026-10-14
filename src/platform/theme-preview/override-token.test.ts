import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_OVERRIDE_MAX_AGE_SECONDS,
  signThemeOverride,
  themeOverrideCookieOptions,
  themeOverrideExpiry,
  verifyThemeOverride,
} from "./override-token";

const NOW = 1_800_000_000_000;
const REVISION = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";

beforeEach(() => vi.stubEnv("AUTH_SECRET", "segredo-de-teste"));
afterEach(() => vi.unstubAllEnvs());

describe("override-token (cookie venore-theme-preview, spec §7.2)", () => {
  it("assina e verifica os três tipos (rascunho, galeria, safe mode)", () => {
    const exp = themeOverrideExpiry(NOW);
    for (const override of [
      { kind: "draft" as const, userId: "u1", revisionId: REVISION, exp },
      { kind: "gallery" as const, userId: "u1", themeKey: "aurora", exp },
      { kind: "safe-mode" as const, userId: "u1", exp },
    ]) {
      const token = signThemeOverride(override);
      expect(token).toMatch(/^[\w-]+\.[\w-]+$/);
      expect(verifyThemeOverride(token ?? undefined, NOW)).toEqual(override);
    }
  });

  it("recusa token adulterado (payload trocado mantendo a assinatura)", () => {
    const token = signThemeOverride({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry(NOW) })!;
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ kind: "safe-mode", userId: "u2", exp: themeOverrideExpiry(NOW) })).toString("base64url");
    expect(verifyThemeOverride(`${forged}.${signature}`, NOW)).toBeNull();
  });

  it("o prefixo separa os tipos: HMAC calculado com o prefixo de outro tipo não vale", () => {
    const payload = Buffer.from(JSON.stringify({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry(NOW) })).toString("base64url");
    const wrongPrefix = createHmac("sha256", "segredo-de-teste").update(`theme-preview:${payload}`).digest("base64url");
    const rightPrefix = createHmac("sha256", "segredo-de-teste").update(`theme-safe-mode:${payload}`).digest("base64url");
    expect(verifyThemeOverride(`${payload}.${wrongPrefix}`, NOW)).toBeNull();
    expect(verifyThemeOverride(`${payload}.${rightPrefix}`, NOW)).not.toBeNull();
  });

  it("recusa outro segredo", () => {
    const token = signThemeOverride({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry(NOW) })!;
    vi.stubEnv("AUTH_SECRET", "outro-segredo");
    expect(verifyThemeOverride(token, NOW)).toBeNull();
  });

  it("vence: depois de exp, nada; e exp além de 2 h a partir de agora também é recusado", () => {
    const exp = themeOverrideExpiry(NOW);
    const token = signThemeOverride({ kind: "safe-mode", userId: "u1", exp })!;
    expect(verifyThemeOverride(token, exp - 1)).not.toBeNull();
    expect(verifyThemeOverride(token, exp)).toBeNull();
    const tooLong = signThemeOverride({ kind: "safe-mode", userId: "u1", exp: NOW + 24 * 3600 * 1000 })!;
    expect(verifyThemeOverride(tooLong, NOW)).toBeNull();
  });

  it("sem AUTH_SECRET não assina nem aceita nada", () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(signThemeOverride({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry(NOW) })).toBeNull();
    expect(verifyThemeOverride("a.b", NOW)).toBeNull();
  });

  it("lixo, campos extras ou malformados não passam", () => {
    expect(verifyThemeOverride(undefined, NOW)).toBeNull();
    expect(verifyThemeOverride("", NOW)).toBeNull();
    expect(verifyThemeOverride("sem-ponto", NOW)).toBeNull();
    expect(verifyThemeOverride("x".repeat(5000), NOW)).toBeNull();
    expect(signThemeOverride({ kind: "draft", userId: "u1", revisionId: "nao-uuid", exp: NOW })).toBeNull();
    expect(signThemeOverride({ kind: "safe-mode", userId: "u 1", exp: NOW })).toBeNull();
  });

  it("cookie: httpOnly, sameSite=lax, secure fora do dev, vida de 2 h", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(themeOverrideCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THEME_OVERRIDE_MAX_AGE_SECONDS,
    });
    expect(THEME_OVERRIDE_MAX_AGE_SECONDS).toBe(7200);
  });
});
