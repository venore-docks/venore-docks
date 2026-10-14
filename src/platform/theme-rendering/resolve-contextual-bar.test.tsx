import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_PAGE_LAYOUT,
  defaultThemeConfigDocument,
  type ContextualBarData,
  type ResolvedThemeDefinition,
  type ThemeRenderModel,
} from "@/contexts/themes/contracts/v8";
import type { PluginRouteTable } from "@/platform/plugin-routing/types";
import { BASE_SLOT_FIXTURE } from "@/platform/theme-gallery/fixtures";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { Shell as SlimeShell } from "@/themes/venore-slime/components/Shell";
import { venoreSlimeManifest } from "@/themes/venore-slime/manifest";
import { venoreSlimeTheme } from "@/themes/venore-slime/theme";

vi.mock("next/navigation", () => ({
  usePathname: () => "/academy/curso/aula",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const getContextualMenu = vi.fn();
vi.mock("@/contexts/cms", () => ({ getContextualMenu: (...args: unknown[]) => getContextualMenu(...args) }));
const tables: { current: Record<string, PluginRouteTable> } = { current: {} };
vi.mock("@/plugins/route-registry", () => ({
  get PLUGIN_ROUTE_TABLES() {
    return tables.current;
  },
}));
const activeKeys: { current: Set<string> } = { current: new Set() };
vi.mock("@/platform/plugin-engine/get-active-plugin-keys", () => ({ getActivePluginKeys: async () => activeKeys.current }));

const LessonNav = () => <nav aria-label="Aulas">aulas</nav>;
const MENU_ITEM = {
  id: "i1",
  label: "Benefícios",
  href: "/rh/beneficios",
  isExternal: false,
  icon: null,
  opensInNewTab: false,
  children: [],
};
const SLOT = <div data-slot-node="">slot</div>;

beforeEach(() => {
  getContextualMenu.mockReset().mockResolvedValue({ success: true, data: [MENU_ITEM] });
  activeKeys.current = new Set(["academy"]);
  tables.current = {
    academy: {
      sidebarContextual: [
        { pattern: "academy/:courseSlug/:lessonId", Component: LessonNav },
        { pattern: "academy/:courseSlug", Component: LessonNav, isEmpty: async (params) => params.courseSlug === "vazio" },
      ],
    },
  };
});

describe("resolveContextualBar", () => {
  it("rota de plugin ATIVO → source plugin com pluginKey e o nó do slot (menu nem é consultado)", async () => {
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    const data = await resolveContextualBar("/academy/curso/aula", SLOT);
    expect(data).toEqual({ source: "plugin", pluginKey: "academy", node: SLOT });
    expect(getContextualMenu).not.toHaveBeenCalled();
  });

  it("B1: padrão de plugin INATIVO cai pro menu contextual do CMS", async () => {
    activeKeys.current = new Set();
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    const data = await resolveContextualBar("/academy/curso/aula", SLOT);
    expect(data.source).toBe("menu");
    expect(getContextualMenu).toHaveBeenCalledWith({ path: "/academy/curso/aula" });
  });

  it("B1: padrão de plugin inativo sem menu → none (nunca coluna vazia)", async () => {
    activeKeys.current = new Set();
    getContextualMenu.mockResolvedValue({ success: true, data: [] });
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    await expect(resolveContextualBar("/academy/curso/aula", SLOT)).resolves.toEqual({ source: "none" });
  });

  it("B6: isEmpty(params) === true não conta como plugin (cai pro menu); false conta", async () => {
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    expect((await resolveContextualBar("/academy/vazio", SLOT)).source).toBe("menu");
    expect((await resolveContextualBar("/academy/cheio", SLOT)).source).toBe("plugin");
  });

  it("isEmpty que lança não esconde o plugin", async () => {
    tables.current.academy.sidebarContextual![1].isEmpty = async () => {
      throw new Error("db fora");
    };
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    expect((await resolveContextualBar("/academy/x", SLOT)).source).toBe("plugin");
  });

  it("decodifica os segmentos do caminho cru antes de casar o padrão", async () => {
    tables.current = { blog: { sidebarContextual: [{ pattern: "notícias/:slug", Component: LessonNav }] } };
    activeKeys.current = new Set(["blog"]);
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    expect(await resolveContextualBar("/not%C3%ADcias/x", SLOT)).toEqual({ source: "plugin", pluginKey: "blog", node: SLOT });
  });

  it("menu do CMS com itens → source menu com scopePath normalizado e itens como view", async () => {
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    const data = await resolveContextualBar("/RH/Beneficios/", SLOT);
    expect(data).toEqual({
      source: "menu",
      scopePath: "/rh/beneficios",
      items: [
        {
          key: "i1",
          label: "Benefícios",
          href: "/rh/beneficios",
          isExternal: false,
          isActive: false,
          icon: null,
          opensInNewTab: false,
          children: [],
        },
      ],
    });
  });

  it("sem pathname, sem plugin e sem itens (ou erro do menu) → none", async () => {
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    await expect(resolveContextualBar(null, SLOT)).resolves.toEqual({ source: "none" });
    getContextualMenu.mockResolvedValue({ success: false, error: { code: "x", message: "x" } });
    await expect(resolveContextualBar("/blog", SLOT)).resolves.toEqual({ source: "none" });
  });

  it("a raiz '/' nunca casa rota de plugin, só o menu", async () => {
    const { resolveContextualBar } = await import("./resolve-contextual-bar");
    expect((await resolveContextualBar("/", SLOT)).source).toBe("menu");
  });
});

describe("resolveSidebarContextualPluginRoute (slot paralelo)", () => {
  it("devolve pluginKey, Component e params; null para inativo ou vazio", async () => {
    const { resolveSidebarContextualPluginRoute } = await import("@/platform/plugin-routing/resolve-sidebar-contextual-route");
    await expect(resolveSidebarContextualPluginRoute(["academy", "c", "l"])).resolves.toEqual({
      pluginKey: "academy",
      Component: LessonNav,
      params: { courseSlug: "c", lessonId: "l" },
    });
    await expect(resolveSidebarContextualPluginRoute(["academy", "vazio"])).resolves.toBeNull();
    activeKeys.current = new Set();
    await expect(resolveSidebarContextualPluginRoute(["academy", "c", "l"])).resolves.toBeNull();
  });

  it("um plugin inativo não bloqueia um plugin ativo posterior com o mesmo padrão", async () => {
    tables.current = {
      old: { sidebarContextual: [{ pattern: "x/:id", Component: LessonNav }] },
      next: { sidebarContextual: [{ pattern: "x/:id", Component: LessonNav }] },
    };
    activeKeys.current = new Set(["next"]);
    const { resolveSidebarContextualPluginRoute } = await import("@/platform/plugin-routing/resolve-sidebar-contextual-route");
    expect((await resolveSidebarContextualPluginRoute(["x", "1"]))?.pluginKey).toBe("next");
  });
});

// ---- B6 no render: `none` não gera a <aside> contextual nem no kit nem no adapter 7.x ----

function model(theme: ResolvedThemeDefinition, contextual: ContextualBarData): ThemeRenderModel {
  return {
    pathname: "/rh",
    area: "public",
    theme,
    config: { ...defaultThemeConfigDocument(theme.key), revisionId: null, publishedAt: null, source: "legacy-synthesis" },
    section: null,
    options: { values: {}, media: {}, ignored: [] },
    fonts: { classNames: "", css: "" },
    locale: "pt-BR",
    dir: "ltr",
    htmlAttributes: {},
    runtimeCss: "",
    override: null,
    diagnostics: { source: "legacy-synthesis", fallback: null, ignoredOptions: [], section: null },
    slotProps: { header: BASE_SLOT_FIXTURE.header, footer: BASE_SLOT_FIXTURE.footer, sidebarLeft: BASE_SLOT_FIXTURE.sidebarLeft },
    breadcrumbs: [],
    breadcrumbsJsonLd: null,
    contextual,
    outlets: {},
    strings: KIT_STRINGS_PT_BR,
    page: DEFAULT_PAGE_LAYOUT,
    maintenance: false,
  };
}

const MENU_DATA: ContextualBarData = {
  source: "menu",
  scopePath: "/rh",
  items: [{ key: "i1", label: "Benefícios", href: "/rh/b", isExternal: false, isActive: false, children: [] }],
};
// Nó de slot que renderiza null — o caso real do slot paralelo (nunca chega como null literal).
const NullSlot = () => null;
const PLUGIN_DATA: ContextualBarData = { source: "plugin", pluginKey: "academy", node: <NullSlot /> };

async function themes() {
  const { normalizeThemeDefinition, normalizeRegistryEntry } = await import("./normalize-entry");
  const kit = normalizeThemeDefinition("venore-slime", venoreSlimeTheme, ["venore-slime"]);
  const legacy = normalizeRegistryEntry({
    contract: 7,
    manifest: { ...venoreSlimeManifest, key: "legacy-fixture", themeContractVersion: "7.0.0" },
    Shell: SlimeShell,
    colorPalettes: [],
    packageVersion: "1.0.0",
    packageName: "@venore/theme-legacy-fixture",
  });
  return { kit, legacy };
}

describe("B6: barra contextual como dado no render", () => {
  it("kit (ThemeRenderer): none → nenhum <aside>; menu → <aside> com o menu", async () => {
    const { ThemeRenderer } = await import("./theme-renderer");
    const { kit } = await themes();
    const none = renderToStaticMarkup(<ThemeRenderer model={model(kit, { source: "none" })}>x</ThemeRenderer>);
    expect(none).not.toContain('data-region="contextual"');
    expect(none).toContain('data-sidebar-contextual="false"');
    const menu = renderToStaticMarkup(<ThemeRenderer model={model(kit, MENU_DATA)}>x</ThemeRenderer>);
    expect(menu).toContain('<aside data-region="contextual"');
    expect(menu).toContain("Benefícios");
  });

  it("kit: contextualPlacement none também suprime o <aside>", async () => {
    const { ThemeRenderer } = await import("./theme-renderer");
    const { kit } = await themes();
    const m = { ...model(kit, MENU_DATA), page: { ...DEFAULT_PAGE_LAYOUT, contextualPlacement: "none" as const } };
    expect(renderToStaticMarkup(<ThemeRenderer model={m}>x</ThemeRenderer>)).not.toContain('data-region="contextual"');
  });

  it("adapter 7.x: none → Shell recebe sidebarContextual=null e enabled=false, sem <aside>", async () => {
    const { LegacyShellAdapter } = await import("./legacy-shell-adapter");
    const { legacy } = await themes();
    const Spy = vi.fn(SlimeShell);
    const theme = { ...legacy, legacyShell: Spy };
    const html = renderToStaticMarkup(<LegacyShellAdapter model={model(theme, { source: "none" })}>x</LegacyShellAdapter>);
    expect(html).not.toContain('data-region="contextual"');
    expect(html).toContain('data-sidebar-contextual="false"');
    expect(Spy.mock.calls[0][0]).toEqual(expect.objectContaining({ sidebarContextual: null, sidebarContextualEnabled: false }));
  });

  it("adapter 7.x: menu → <aside> com o menu do kit", async () => {
    const { LegacyShellAdapter } = await import("./legacy-shell-adapter");
    const { legacy } = await themes();
    const html = renderToStaticMarkup(<LegacyShellAdapter model={model(legacy, MENU_DATA)}>x</LegacyShellAdapter>);
    expect(html).toContain('<aside data-region="contextual"');
    expect(html).toContain('aria-label="Navegação contextual"');
  });

  it("plugin: o <aside> só existe porque o resolver decidiu 'plugin' (isEmpty é quem evita a coluna vazia)", async () => {
    const { ThemeRenderer } = await import("./theme-renderer");
    const { kit } = await themes();
    const html = renderToStaticMarkup(<ThemeRenderer model={model(kit, PLUGIN_DATA)}>x</ThemeRenderer>);
    expect(html).toContain('<aside data-region="contextual"');
  });

  it("região do kit renderiza os outlets contextual.top/bottom em volta do conteúdo", async () => {
    const { ThemeRenderer } = await import("./theme-renderer");
    const { kit } = await themes();
    const m = {
      ...model(kit, MENU_DATA),
      outlets: { "contextual.top": <i data-x="top" />, "contextual.bottom": <i data-x="bottom" /> },
    };
    const html = renderToStaticMarkup(<ThemeRenderer model={m}>x</ThemeRenderer>);
    const aside = html.slice(html.indexOf("<aside"));
    expect(aside.indexOf('data-x="top"')).toBeGreaterThan(-1);
    expect(aside.indexOf('data-x="top"')).toBeLessThan(aside.indexOf("Benefícios"));
    expect(aside.indexOf("Benefícios")).toBeLessThan(aside.indexOf('data-x="bottom"'));
  });
});
