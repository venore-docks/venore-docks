import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const issueSafeModeToken = vi.fn();
vi.mock("@/platform/theme-engine/theme-config", () => ({ issueSafeModeToken: () => issueSafeModeToken() }));

const { GET } = await import("./route");
const { THEME_PREVIEW_COOKIE, signThemeOverride, themeOverrideExpiry, verifyThemeOverride } = await import(
  "@/platform/theme-preview/override-token"
);

const request = (query: string, headers: Record<string, string> = {}) => new NextRequest(`https://site.test/api/themes/safe-mode${query}`, { headers });

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "segredo-de-teste");
  issueSafeModeToken.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/themes/safe-mode (spec §7.2)", () => {
  it("?on=1 autorizado: grava o cookie assinado para ESTE admin e redireciona", async () => {
    const token = signThemeOverride({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry() })!;
    issueSafeModeToken.mockResolvedValueOnce({ success: true, data: { token } });
    const response = await GET(request("?on=1&next=/blog"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://site.test/blog");
    const cookie = response.cookies.get(THEME_PREVIEW_COOKIE);
    expect(cookie?.value).toBe(token);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.maxAge).toBe(7200);
    expect(verifyThemeOverride(cookie?.value)).toMatchObject({ kind: "safe-mode", userId: "u1" });
  });

  it("sem sessão / sem settings.manage: nenhum cookie", async () => {
    issueSafeModeToken.mockResolvedValueOnce({ success: false, error: { code: "rbac.authorization.unauthenticated", message: "x" } });
    const anonymous = await GET(request("?on=1"));
    expect(anonymous.status).toBe(401);
    expect(anonymous.cookies.get(THEME_PREVIEW_COOKIE)).toBeUndefined();

    issueSafeModeToken.mockResolvedValueOnce({ success: false, error: { code: "rbac.authorization.forbidden", message: "x" } });
    const forbidden = await GET(request("?on=1"));
    expect(forbidden.status).toBe(403);
    expect(forbidden.cookies.get(THEME_PREVIEW_COOKIE)).toBeUndefined();
  });

  it("?on=0 apaga o cookie deste navegador, sem assinar nada", async () => {
    const response = await GET(request("?on=0"));
    expect(response.status).toBe(303);
    expect(response.cookies.get(THEME_PREVIEW_COOKIE)?.value).toBe("");
    expect(issueSafeModeToken).not.toHaveBeenCalled();
  });

  it("parâmetro inválido, navegação de outro site e next externo", async () => {
    expect((await GET(request("?on=talvez"))).status).toBe(400);
    expect((await GET(request("?on=1", { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(issueSafeModeToken).not.toHaveBeenCalled();
    const external = await GET(request("?on=0&next=//evil.test/x"));
    expect(external.headers.get("location")).toBe("https://site.test/admin/themes");
  });
});
