import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminPageGate } from "@/platform/admin-shell/types";

// document-model é congelado (Fase F); este teste cobre só o que o W6 pluga nele: override do
// cookie (safe mode / rascunho) e seção com tema próprio — spec §6 passos 3-7.
const { THEME_REGISTRY } = await import("@/themes/registry");
// Três temas instalados além do slime (o registro vem do codegen; nomes não importam).
const [SITE, SECTION, DRAFT] = Object.keys(THEME_REGISTRY).filter((key) => key !== "venore-slime");
const jar = new Map<string, string>();
let pathname = "/";
let gate: AdminPageGate = { granted: false, reason: "unauthenticated" };
let enabledStates: Record<string, { enabled: boolean }> = {};
const publishedConfig = {
  schemaVersion: 1 as const,
  themeKey: SITE,
  byTheme: {},
  assets: {},
  sections: [{ id: "rh", label: "RH", pathPrefix: "/rh", themeKey: SECTION }],
  revisionId: "pub",
  publishedAt: null,
  source: "settings" as const,
};
const getThemeConfigRevision = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-breadcrumb-pathname": pathname }),
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("next/font/google", async () => (await import("@/test-support/themes/next-font-google-mock")).nextFontGoogleMock());
vi.mock("@/contexts/themes", async (importOriginal) => {
  const rules = await importOriginal<typeof import("@/contexts/themes")>();
  return {
    getPublishedThemeConfig: async () => ({ success: true, data: publishedConfig }),
    getThemeConfigRevision: (...args: unknown[]) => getThemeConfigRevision(...args),
    isReservedSectionPrefix: rules.isReservedSectionPrefix,
  };
});
vi.mock("@/contexts/extensions", () => ({ listExtensionStates: async () => ({ success: true, data: enabledStates }) }));
vi.mock("@/platform/admin-shell/get-admin-page-data", () => ({ getAdminPageData: async () => gate }));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const { resolveDocumentModel } = await import("./document-model");
const { THEME_PREVIEW_COOKIE, signThemeOverride, themeOverrideExpiry } = await import("@/platform/theme-preview/override-token");

const admin = (id: string): AdminPageGate => ({
  granted: true,
  actor: { id, name: id, email: `${id}@x.test`, isSuperadmin: false, permissions: ["platform.admin.access", "settings.manage"] },
});
const REVISION = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "segredo-de-teste");
  jar.clear();
  pathname = "/";
  gate = { granted: false, reason: "unauthenticated" };
  enabledStates = {};
  getThemeConfigRevision.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe.skipIf(!DRAFT)("document-model com override e seção (W6)", () => {
  it("safe mode vale só para o admin dono do cookie", async () => {
    jar.set(THEME_PREVIEW_COOKIE, signThemeOverride({ kind: "safe-mode", userId: "u1", exp: themeOverrideExpiry() })!);
    gate = admin("u1");
    const own = await resolveDocumentModel();
    expect(own.theme.key).toBe("venore-slime");
    expect(own.diagnostics.source).toBe("safe-mode");

    gate = admin("u2");
    const other = await resolveDocumentModel();
    expect(other.theme.key).toBe(SITE);
    expect(other.override).toBeNull();
  });

  it("visitante sem cookie: config publicada", async () => {
    const model = await resolveDocumentModel();
    expect(model.theme.key).toBe(SITE);
    expect(model.diagnostics.source).toBe("settings");
  });

  it("preview de rascunho: o dono vê a config do rascunho", async () => {
    jar.set(THEME_PREVIEW_COOKIE, signThemeOverride({ kind: "draft", userId: "u1", revisionId: REVISION, exp: themeOverrideExpiry() })!);
    gate = admin("u1");
    getThemeConfigRevision.mockResolvedValue({
      success: true,
      data: { id: REVISION, status: "draft", publishedAt: null, config: { schemaVersion: 1, themeKey: DRAFT, byTheme: {}, assets: {}, sections: [] } },
    });
    const model = await resolveDocumentModel();
    expect(model.theme.key).toBe(DRAFT);
    expect(model.diagnostics.source).toBe("draft");
  });

  it("seção troca o tema no caminho dela; tema da seção desabilitado cai no fallback", async () => {
    pathname = "/rh/vagas";
    const model = await resolveDocumentModel();
    expect(model.section?.id).toBe("rh");
    expect(model.theme.key).toBe(SECTION);

    enabledStates = { [SECTION]: { enabled: false } };
    const disabled = await resolveDocumentModel();
    expect(disabled.theme.key).toBe("venore-slime");
    expect(disabled.diagnostics.fallback).toEqual({ reason: "disabled", requestedKey: SECTION });
  });

  it("seção nunca vale no admin", async () => {
    pathname = "/admin/rh";
    const model = await resolveDocumentModel();
    expect(model.section).toBeNull();
    expect(model.theme.key).toBe(SITE);
  });
});
