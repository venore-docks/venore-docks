import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server.edge";
import { JSDOM } from "jsdom";
import type { ReactNode } from "react";
import { THEME_TEMPLATE_KEYS } from "@/contexts/themes/contracts/v8";
import { THEME_REGISTRY } from "@/themes/registry";

// Galeria viva (spec v8 §7.13): gate settings.manage, qualquer `?theme=` renderizado sem ativar,
// raiz `[data-gallery-root][data-theme=k]` com CSS de runtime com escopo, e todas as seções
// (layouts, regiões, templates, estados, blocos com variantes/estilos, tokens, opções).
const gate = vi.hoisted(() => ({ granted: true }));
const writes = vi.hoisted(() => ({ activateTheme: vi.fn(), activateColorPalette: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/themes/gallery",
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
// Temas além do venore-slime vêm das fixtures do repo (v8 pai/filho e um 7.x), não dos pacotes
// @venore/theme-* instalados no branch.
vi.mock("@/themes/registry.generated", async () => ({
  GENERATED_THEME_REGISTRY: (await import("@/test-support/themes/fixture-registry")).FIXTURE_THEME_REGISTRY,
}));
vi.mock("next/font/google", async () => (await import("@/test-support/themes/next-font-google-mock")).nextFontGoogleMock());
vi.mock("@/platform/admin-shell/get-settings-page-data", () => ({
  getSettingsPageData: async () => (gate.granted ? { granted: true, actor: { userId: "u1" } } : { granted: false }),
}));
vi.mock("@/platform/theme-engine/list-theme-states", () => ({
  listThemeStates: async () =>
    Object.values(THEME_REGISTRY).map(({ manifest }) => ({
      manifest,
      enabled: manifest.key !== "fixture-child",
      isActive: manifest.key === "venore-slime",
      canDisable: false,
      disableBlockedReason: null,
    })),
}));
vi.mock("@/platform/plugin-engine/get-active-plugin-keys", () => ({ getActivePluginKeys: async () => new Set<string>() }));
vi.mock("@/contexts/rbac", () => ({ authorizeActor: async () => ({ authorized: true }) }));
vi.mock("@/platform/theme-engine/activate-theme", () => ({ activateTheme: writes.activateTheme }));
vi.mock("@/platform/theme-engine/activate-color-palette", () => ({ activateColorPalette: writes.activateColorPalette }));

async function render(node: ReactNode): Promise<Document> {
  const stream = await renderToReadableStream(node, { onError: () => {} });
  await stream.allReady;
  const html = await new Response(stream).text();
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`).window.document;
}

async function renderPage(search: Record<string, string>): Promise<Document> {
  const { default: Page } = await import("./page");
  return render(await Page({ searchParams: Promise.resolve(search) }));
}

beforeEach(() => {
  gate.granted = true;
  writes.activateTheme.mockClear();
  writes.activateColorPalette.mockClear();
});

describe("/admin/themes/gallery", () => {
  it("exige settings.manage", async () => {
    gate.granted = false;
    const doc = await renderPage({ theme: "fixture-parent" });
    expect(doc.body.textContent).toContain("Acesso negado");
    expect(doc.querySelector("[data-gallery-root]")).toBeNull();
  });

  it("renderiza ?theme= (não ativo) sem ativá-lo, com raiz e CSS com escopo", async () => {
    const doc = await renderPage({ theme: "fixture-parent", mode: "dark" });
    const roots = [...doc.querySelectorAll("[data-gallery-root]")];
    expect(roots.length).toBeGreaterThan(0);
    for (const root of roots) {
      expect(root.getAttribute("data-theme")).toBe("fixture-parent");
      expect(root.classList.contains("dark")).toBe(true);
      expect(root.hasAttribute("hidden")).toBe(true);
    }
    // Nada no admin em volta muda: nenhum seletor do <html>.
    for (const style of doc.querySelectorAll("style[data-gallery-css]")) {
      expect(style.textContent).not.toContain("html[");
    }
    expect(writes.activateTheme).not.toHaveBeenCalled();
    expect(writes.activateColorPalette).not.toHaveBeenCalled();
  });

  it("mostra todas as seções: layouts 390/1280, regiões, templates, estados, blocos, tokens e opções", async () => {
    const doc = await renderPage({ theme: "venore-slime" });
    for (const id of ["gallery-layouts", "gallery-regions", "gallery-templates", "gallery-states", "gallery-blocks", "gallery-tokens", "gallery-options"]) {
      expect(doc.getElementById(id), id).not.toBeNull();
    }
    const captions = [...doc.querySelectorAll("figcaption")].map((caption) => caption.textContent ?? "");
    expect(captions.filter((caption) => caption.includes("390px")).length).toBeGreaterThanOrEqual(2);
    expect(captions.filter((caption) => caption.includes("1280px")).length).toBeGreaterThanOrEqual(2);
    expect(captions.some((caption) => caption.startsWith("Preset rail"))).toBe(true);
    for (const key of THEME_TEMPLATE_KEYS) expect(captions.some((caption) => caption.startsWith(`${key} · default`)), key).toBe(true);
    // Shell do kit dentro das molduras (fonte escondida), com os landmarks.
    expect(doc.querySelectorAll("[data-gallery-root] #site-header").length).toBeGreaterThan(0);
    // Blocos do core e estilos de seção (W5) com os marcadores de apresentação.
    expect(doc.querySelectorAll("[data-gallery-root] [data-block]").length).toBeGreaterThan(10);
    for (const style of ["muted", "brand", "inverted", "accent"]) {
      expect(doc.querySelector(`[data-gallery-root] [data-section-style="${style}"]`), style).not.toBeNull();
    }
    // Estados.
    const statesText = doc.getElementById("gallery-states")?.closest("section")?.textContent ?? "";
    for (const kind of ["loading", "empty", "forbidden", "notFound", "maintenance", "error"]) expect(statesText).toContain(kind);
    // Contraste por região, claro e escuro.
    const tokens = doc.getElementById("gallery-tokens")?.closest("section")?.textContent ?? "";
    for (const region of ["header", "rail", "contextual", "content", "footer"]) expect(tokens).toContain(region);
    expect(tokens).toContain("--background");
  });

  it("tema desabilitado cai no fallback com aviso (como o render faria)", async () => {
    const doc = await renderPage({ theme: "fixture-child" });
    expect(doc.body.textContent).toContain("está desabilitado");
    expect(doc.querySelector("[data-gallery-root]")?.getAttribute("data-theme")).toBe("venore-slime");
  });

  it("tema 7.x mostra o Shell do pacote nas molduras", async () => {
    const doc = await renderPage({ theme: "fixture-legacy" });
    const captions = [...doc.querySelectorAll("figcaption")].map((caption) => caption.textContent ?? "");
    expect(captions.some((caption) => caption.startsWith("Shell 7.x do pacote"))).toBe(true);
    expect(captions.some((caption) => caption.startsWith("Preset rail"))).toBe(false);
  });
});

describe("/admin/themes/preview", () => {
  it("redireciona pra galeria preservando tema e modo", async () => {
    const { default: Preview } = await import("../preview/page");
    await expect(Preview({ searchParams: Promise.resolve({ theme: "fixture-parent", dark: "1" }) })).rejects.toMatchObject({
      url: "/admin/themes/gallery?theme=fixture-parent&mode=dark",
    });
    await expect(Preview({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({ url: "/admin/themes/gallery" });
  });
});
