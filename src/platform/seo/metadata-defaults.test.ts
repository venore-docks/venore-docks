import { beforeEach, describe, expect, it, vi } from "vitest";

// Metadata padrão (spec v8 §7.7/§7.9): og:image padrão do tema e noindex só para quem vê o aviso
// de manutenção.
const state = vi.hoisted(() => ({ granted: false, enabled: false, og: undefined as undefined | { url: string }[], pwaIconUrl: null as string | null }));
vi.mock("@/platform/brand/get-brand-config", () => ({
  getBrandConfig: async () => ({ siteName: "S", footerDescription: "D", faviconUrl: "/f.ico", pwaIconUrl: state.pwaIconUrl }),
}));
vi.mock("./site-origin", () => ({ getSiteOrigin: async () => "https://s.test" }));
vi.mock("./og-image", () => ({ resolveDefaultOgImage: async () => state.og }));
vi.mock("@/platform/admin-shell/get-admin-page-data", () => ({ getAdminPageData: async () => ({ granted: state.granted }) }));
vi.mock("@/platform/theme-rendering/resolve-maintenance", () => ({
  resolveMaintenance: async (gate: { granted: boolean }) => state.enabled && !gate.granted,
}));

const { resolveThemeMetadataDefaults } = await import("./metadata-defaults");

beforeEach(() => {
  state.granted = false;
  state.enabled = false;
  state.og = undefined;
  state.pwaIconUrl = null;
});

describe("resolveThemeMetadataDefaults", () => {
  it("sem manutenção nem imagem: o metadata de antes da v8", async () => {
    const metadata = await resolveThemeMetadataDefaults();
    expect(metadata.robots).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.title).toEqual({ default: "S", template: "%s · S" });
  });

  it("manutenção: noindex para o visitante, nada para o admin", async () => {
    state.enabled = true;
    expect((await resolveThemeMetadataDefaults()).robots).toEqual({ index: false, follow: false });
    state.granted = true;
    expect((await resolveThemeMetadataDefaults()).robots).toBeUndefined();
  });

  it("ícone do iOS: o ícone do app da identidade do site, senão o padrão do core", async () => {
    expect((await resolveThemeMetadataDefaults()).icons).toMatchObject({ icon: "/f.ico", apple: "/icons/apple-touch-icon.png" });
    state.pwaIconUrl = "/media/app.png";
    expect((await resolveThemeMetadataDefaults()).icons).toMatchObject({ icon: "/f.ico", apple: "/media/app.png" });
  });

  it("imagem padrão de Open Graph", async () => {
    state.og = [{ url: "https://s.test/og.png" }];
    expect((await resolveThemeMetadataDefaults()).openGraph).toEqual({ siteName: "S", images: [{ url: "https://s.test/og.png" }] });
  });
});
