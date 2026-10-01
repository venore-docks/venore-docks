import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminPageGate } from "@/platform/admin-shell/types";

const jar = new Map<string, string>();
let gate: AdminPageGate = { granted: false, reason: "unauthenticated" };
const getThemeConfigRevision = vi.fn();
const getAdminPageData = vi.fn(async () => gate);

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("@/contexts/themes", () => ({ getThemeConfigRevision: (...args: unknown[]) => getThemeConfigRevision(...args) }));
vi.mock("@/platform/admin-shell/get-admin-page-data", () => ({ getAdminPageData: () => getAdminPageData() }));

const { evaluateThemeOverride, loadOverrideThemeConfig, readThemeOverride } = await import("./read-theme-override");
const { THEME_PREVIEW_COOKIE, signThemeOverride, themeOverrideExpiry } = await import("@/platform/theme-preview/override-token");

const NOW = Date.now();
const REVISION = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";
const admin = (id: string, permissions: string[] = ["platform.admin.access", "settings.manage"], isSuperadmin = false): AdminPageGate => ({
  granted: true,
  actor: { id, name: id, email: `${id}@x.test`, isSuperadmin, permissions },
});

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "segredo-de-teste");
  jar.clear();
  gate = { granted: false, reason: "unauthenticated" };
  getAdminPageData.mockClear();
  getThemeConfigRevision.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("evaluateThemeOverride — o cookie só vale para o dono, com settings.manage, fora de /ext", () => {
  const safeMode = () => signThemeOverride({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry(NOW) })!;

  it("dono com settings.manage: aceito", () => {
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/", gate: admin("u1"), now: NOW })?.kind).toBe("safe-mode");
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/", gate: admin("u1", [], true), now: NOW })?.kind).toBe("safe-mode");
  });

  it("outro usuário (mesmo admin com settings.manage): ignorado", () => {
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/", gate: admin("u2"), now: NOW })).toBeNull();
  });

  it("sem settings.manage ou sem sessão: ignorado", () => {
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/", gate: admin("u1", ["platform.admin.access"]), now: NOW })).toBeNull();
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/", gate: { granted: false, reason: "forbidden" }, now: NOW })).toBeNull();
  });

  it("vencido: ignorado", () => {
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/", gate: admin("u1"), now: themeOverrideExpiry(NOW) + 1 })).toBeNull();
  });

  it("em /ext/**: ignorado", () => {
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/ext/broadcast/out/abc", gate: admin("u1"), now: NOW })).toBeNull();
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/ext", gate: admin("u1"), now: NOW })).toBeNull();
    expect(evaluateThemeOverride({ token: safeMode(), pathname: "/extra", gate: admin("u1"), now: NOW })?.kind).toBe("safe-mode");
  });
});

describe("readThemeOverride", () => {
  it("sem cookie não consulta a sessão (visitante anônimo não paga nada)", async () => {
    expect(await readThemeOverride({ pathname: "/", area: "public" })).toBeNull();
    expect(getAdminPageData).not.toHaveBeenCalled();
  });

  it("cookie inválido também não consulta a sessão", async () => {
    jar.set(THEME_PREVIEW_COOKIE, "lixo.lixo");
    expect(await readThemeOverride({ pathname: "/", area: "public" })).toBeNull();
    expect(getAdminPageData).not.toHaveBeenCalled();
  });

  it("cookie válido do usuário da sessão vira override; de outro usuário, não", async () => {
    jar.set(THEME_PREVIEW_COOKIE, signThemeOverride({ kind: "draft", userId: "u1", revisionId: REVISION, exp: themeOverrideExpiry() })!);
    gate = admin("u1");
    expect((await readThemeOverride({ pathname: "/blog", area: "public" }))?.kind).toBe("draft");
    gate = admin("u2");
    expect(await readThemeOverride({ pathname: "/blog", area: "public" })).toBeNull();
  });

  it("em /ext nada é lido", async () => {
    jar.set(THEME_PREVIEW_COOKIE, signThemeOverride({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry() })!);
    gate = admin("u1");
    expect(await readThemeOverride({ pathname: "/ext/tv", area: "public" })).toBeNull();
    expect(getAdminPageData).not.toHaveBeenCalled();
  });
});

describe("loadOverrideThemeConfig — config do rascunho no render", () => {
  const published = async () => ({
    success: true as const,
    data: {
      schemaVersion: 1 as const,
      themeKey: "venore-slime",
      byTheme: {},
      assets: {},
      sections: [],
      revisionId: "pub",
      publishedAt: null,
      source: "settings" as const,
    },
  });
  const draftOverride = { kind: "draft" as const, userId: "u1", revisionId: REVISION, exp: themeOverrideExpiry() };

  it("override de rascunho: usa a config da revisão", async () => {
    getThemeConfigRevision.mockResolvedValue({
      success: true,
      data: { id: REVISION, status: "draft", config: { schemaVersion: 1, themeKey: "aurora", byTheme: {}, assets: {}, sections: [] }, publishedAt: null },
    });
    const result = await loadOverrideThemeConfig(draftOverride, published);
    expect(result.success && result.data.themeKey).toBe("aurora");
    expect(result.success && result.data.revisionId).toBe(REVISION);
  });

  it("rascunho descartado ou tabela ausente: cai na publicada", async () => {
    getThemeConfigRevision.mockResolvedValueOnce({ success: true, data: null });
    expect((await loadOverrideThemeConfig(draftOverride, published)).success && "ok").toBe("ok");
    getThemeConfigRevision.mockResolvedValueOnce({ success: false, error: { code: "themes.config.storage_unavailable", message: "x" } });
    const result = await loadOverrideThemeConfig(draftOverride, published);
    expect(result.success && result.data.revisionId).toBe("pub");
  });

  it("sem override ou override de outro tipo: publicada, sem ler revisão", async () => {
    await loadOverrideThemeConfig(null, published);
    await loadOverrideThemeConfig({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry() }, published);
    expect(getThemeConfigRevision).not.toHaveBeenCalled();
  });
});
