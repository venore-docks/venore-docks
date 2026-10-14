import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import {
  DEFAULT_PAGE_LAYOUT,
  LEGACY_THEME_OUTLETS,
  THEME_OUTLET_NAMES,
  defaultThemeConfigDocument,
  type FooterRegionProps,
  type OutletRenderContext,
  type RegionOverride,
  type ResolvedThemeDefinition,
  type ThemeOutletNodes,
  type ThemeRenderModel,
} from "@/contexts/themes/contracts/v8";
import type { PluginContributions } from "@/platform/plugin-engine/plugin-contributions";
import { BASE_SLOT_FIXTURE } from "@/platform/theme-gallery/fixtures";
import { FIXTURE_OUTLETS_PLUGIN_KEY, fixtureOutletsContributions } from "@/plugins/_fixture-outlets";
import { defineTheme } from "@/theme-sdk/define";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { Shell as SlimeShell } from "@/themes/venore-slime/components/Shell";
import { venoreSlimeManifest } from "@/themes/venore-slime/manifest";
import { venoreSlimeTheme } from "@/themes/venore-slime/theme";

vi.mock("next/navigation", () => ({
  usePathname: () => "/blog/ola",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/contexts/cms", () => ({ getContextualMenu: async () => ({ success: true, data: [] }) }));
vi.mock("@/plugins/route-registry", () => ({ PLUGIN_ROUTE_TABLES: {} }));
const beginOperation = vi.fn((input: { useCase: string }) => ({ useCase: input.useCase }));
const endOperation = vi.fn();
vi.mock("@/observability", () => ({
  beginOperation: (input: { useCase: string }) => beginOperation(input),
  endOperation: (...args: unknown[]) => endOperation(...args),
}));
const registry: { current: Record<string, PluginContributions> } = { current: {} };
vi.mock("@/plugins/contributions", () => ({
  get PLUGIN_CONTRIBUTIONS() {
    return registry.current;
  },
}));
const activeKeys: { current: Set<string> } = { current: new Set() };
vi.mock("@/platform/plugin-engine/get-active-plugin-keys", () => ({ getActivePluginKeys: async () => activeKeys.current }));

const FIXTURE_REGISTRY = { [FIXTURE_OUTLETS_PLUGIN_KEY]: fixtureOutletsContributions };
const ACTIVE = new Set([FIXTURE_OUTLETS_PLUGIN_KEY]);
const FAST_TIMEOUT_MS = 50;

function ctx(pathname: string, area: "public" | "admin" = "public"): OutletRenderContext {
  return { pathname, area, user: null, canAccessAdmin: false, themeKey: "venore-slime", locale: "pt-BR" };
}

function keysOf(selected: Partial<Record<string, { pluginKey: string; contribution: { key: string } }[]>>, outlet: string) {
  return (selected[outlet] ?? []).map((item) => `${item.pluginKey}:${item.contribution.key}`);
}

async function ssr(node: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(node, { onError: () => {} });
  await stream.allReady;
  return new Response(stream).text();
}

beforeEach(() => {
  beginOperation.mockClear();
  endOperation.mockClear();
  registry.current = {};
  activeKeys.current = new Set();
});

describe("selectOutletContributions", () => {
  it("ignora plugins inativos (nem chama render)", async () => {
    const { selectOutletContributions } = await import("./resolve-theme-outlets");
    expect(selectOutletContributions(FIXTURE_REGISTRY, new Set(), ctx("/blog/ola"), THEME_OUTLET_NAMES)).toEqual({});
  });

  it("ordena por (order ?? 100, pluginKey, key), de forma determinística", async () => {
    const { selectOutletContributions } = await import("./resolve-theme-outlets");
    const render = async () => null;
    const reg: Record<string, PluginContributions> = {
      zeta: { outlets: [{ key: "a", outlet: "content.before", render }] },
      alpha: {
        outlets: [
          { key: "b", outlet: "content.before", render },
          { key: "a", outlet: "content.before", render },
          { key: "first", outlet: "content.before", order: 5, render },
        ],
      },
    };
    const active = new Set(["zeta", "alpha"]);
    const first = keysOf(selectOutletContributions(reg, active, ctx("/"), THEME_OUTLET_NAMES), "content.before");
    expect(first).toEqual(["alpha:first", "alpha:a", "alpha:b", "zeta:a"]);
    // Ordem de inserção do registro não importa.
    const reversed = Object.fromEntries(Object.entries(reg).reverse());
    expect(keysOf(selectOutletContributions(reversed, active, ctx("/"), THEME_OUTLET_NAMES), "content.before")).toEqual(first);
  });

  it("filtra por área (padrão só public; admin só com areas: ['admin'])", async () => {
    const { selectOutletContributions } = await import("./resolve-theme-outlets");
    const pub = selectOutletContributions(FIXTURE_REGISTRY, ACTIVE, ctx("/x"), THEME_OUTLET_NAMES);
    expect(keysOf(pub, "content.before")).not.toContain("fixture-outlets:admin-only");
    const admin = selectOutletContributions(FIXTURE_REGISTRY, ACTIVE, ctx("/admin", "admin"), THEME_OUTLET_NAMES);
    expect(keysOf(admin, "content.before")).toEqual(["fixture-outlets:admin-only"]);
  });

  it("filtra por match (patterns da route-table; caminho decodificado)", async () => {
    const { selectOutletContributions } = await import("./resolve-theme-outlets");
    const post = selectOutletContributions(FIXTURE_REGISTRY, ACTIVE, ctx("/blog/ol%C3%A1"), THEME_OUTLET_NAMES);
    expect(keysOf(post, "content.after")).toContain("fixture-outlets:blog-only");
    const other = selectOutletContributions(FIXTURE_REGISTRY, ACTIVE, ctx("/blog"), THEME_OUTLET_NAMES);
    expect(keysOf(other, "content.after")).not.toContain("fixture-outlets:blog-only");
  });

  it("descarta outlets que o tema não renderiza (7.x: só content.before/after)", async () => {
    const { selectOutletContributions } = await import("./resolve-theme-outlets");
    const legacy = selectOutletContributions(FIXTURE_REGISTRY, ACTIVE, ctx("/x"), LEGACY_THEME_OUTLETS);
    expect(Object.keys(legacy).sort()).toEqual(["content.after", "content.before"]);
  });

  it("mapeia publicHomeShowcase para home.showcase só na home, e o outlet declarado vence", async () => {
    const { selectOutletContributions } = await import("./resolve-theme-outlets");
    const showcase = async () => <p>vitrine</p>;
    const legacyOnly = { p: { publicHomeShowcase: showcase } };
    expect(keysOf(selectOutletContributions(legacyOnly, new Set(["p"]), ctx("/"), THEME_OUTLET_NAMES), "home.showcase")).toEqual([
      "p:public-home-showcase",
    ]);
    expect(selectOutletContributions(legacyOnly, new Set(["p"]), ctx("/blog"), THEME_OUTLET_NAMES)).toEqual({});
    const both = { p: { publicHomeShowcase: showcase, outlets: [{ key: "own", outlet: "home.showcase" as const, render: showcase }] } };
    expect(keysOf(selectOutletContributions(both, new Set(["p"]), ctx("/"), THEME_OUTLET_NAMES), "home.showcase")).toEqual(["p:own"]);
  });
});

describe("runOutletContribution", () => {
  it("isola uma contribuição que lança (null + operação com falha)", async () => {
    const { runOutletContribution } = await import("./resolve-theme-outlets");
    const boom = fixtureOutletsContributions.outlets!.find((outlet) => outlet.key === "boom")!;
    await expect(runOutletContribution({ pluginKey: "fixture-outlets", contribution: boom }, ctx("/"))).resolves.toBeNull();
    expect(beginOperation).toHaveBeenCalledWith(expect.objectContaining({ useCase: "platform.theme-outlets.render" }));
    expect(endOperation).toHaveBeenCalledWith(expect.anything(), {
      success: false,
      error: expect.objectContaining({ code: "platform.theme_outlets.render_failed" }),
    });
  });

  it("isola uma contribuição que passa do timeout (null)", async () => {
    const { runOutletContribution } = await import("./resolve-theme-outlets");
    const slow = fixtureOutletsContributions.outlets!.find((outlet) => outlet.key === "slow")!;
    const started = Date.now();
    await expect(runOutletContribution({ pluginKey: "fixture-outlets", contribution: slow }, ctx("/"), FAST_TIMEOUT_MS)).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(endOperation).toHaveBeenCalledWith(expect.anything(), {
      success: false,
      error: expect.objectContaining({ code: "platform.theme_outlets.timeout" }),
    });
  });

  it("uma contribuição síncrona que lança também vira null", async () => {
    const { runOutletContribution } = await import("./resolve-theme-outlets");
    const sync = {
      key: "sync",
      outlet: "content.before" as const,
      render: (() => {
        throw new Error("sync");
      }) as unknown as () => Promise<null>,
    };
    await expect(runOutletContribution({ pluginKey: "p", contribution: sync }, ctx("/"))).resolves.toBeNull();
  });
});

describe("resolveThemeOutlets (registro real, mockado)", () => {
  it("sem contribuição nenhuma devolve {} sem consultar plugins ativos", async () => {
    const { resolveThemeOutlets } = await import("./resolve-theme-outlets");
    const theme = { outletsRendered: THEME_OUTLET_NAMES } as unknown as ResolvedThemeDefinition;
    await expect(resolveThemeOutlets(ctx("/"), theme)).resolves.toEqual({});
  });

  it("plugin inativo não contribui nada", async () => {
    registry.current = FIXTURE_REGISTRY;
    const { resolveThemeOutlets } = await import("./resolve-theme-outlets");
    const theme = { outletsRendered: THEME_OUTLET_NAMES } as unknown as ResolvedThemeDefinition;
    await expect(resolveThemeOutlets(ctx("/"), theme)).resolves.toEqual({});
    activeKeys.current = ACTIVE;
    expect(Object.keys(await resolveThemeOutlets(ctx("/"), theme))).toEqual(
      expect.arrayContaining(["content.before", "content.after", "footer.top"]),
    );
  });
});

describe("diagnoseOutlets", () => {
  it("lista outlets declarados (contribuição e manifesto) que o tema ativo não renderiza", async () => {
    const { diagnoseOutlets } = await import("./resolve-theme-outlets");
    const result = diagnoseOutlets(
      FIXTURE_REGISTRY,
      { other: { outlets: [{ key: "x", outlet: "rail.top" }, { key: "y", outlet: "nope" }] } },
      LEGACY_THEME_OUTLETS,
      THEME_OUTLET_NAMES,
    );
    expect(result).toEqual(
      expect.arrayContaining([
        { pluginKey: "fixture-outlets", key: "footer-note", outlet: "footer.top", source: "contribution", reason: "not-rendered-by-theme" },
        { pluginKey: "other", key: "x", outlet: "rail.top", source: "manifest", reason: "not-rendered-by-theme" },
        { pluginKey: "other", key: "y", outlet: "nope", source: "manifest", reason: "unknown-outlet" },
      ]),
    );
    expect(result.some((item) => item.key === "banner")).toBe(false);
  });
});

// ---- SSR: a fixture renderiza no slime (kit), num tema v8 de fixture e no adapter 7.x ----

async function modelFor(theme: ResolvedThemeDefinition, outlets: ThemeOutletNodes, pathname = "/blog/ola"): Promise<ThemeRenderModel> {
  return {
    pathname,
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
    contextual: { source: "none" },
    outlets,
    strings: KIT_STRINGS_PT_BR,
    page: DEFAULT_PAGE_LAYOUT,
    maintenance: false,
  };
}

function expectOrdered(html: string, markers: string[]) {
  const positions = markers.map((marker) => html.indexOf(`data-fixture-outlet="${marker}"`));
  for (const position of positions) expect(position).toBeGreaterThan(-1);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
}

// Tema v8 de fixture: rodapé substituído que renderiza os outlets que recebe; o manifesto declara
// os outlets que a região custom renderiza.
const FixtureFooter: RegionOverride<FooterRegionProps> = ({ slots }) => (
  <footer data-region="footer" data-fixture-footer="">
    {slots.outletTop}
    <p>rodapé da fixture</p>
    {slots.outletBottom}
  </footer>
);
const fixtureV8Theme = defineTheme({
  manifest: {
    ...venoreSlimeManifest,
    key: "fixture-outlets-theme",
    name: "Fixture outlets",
    outlets: ["content.before", "content.after", "footer.top", "footer.bottom"],
  },
  layout: "topbar",
  regions: { footer: FixtureFooter },
});

describe("SSR com a fixture _fixture-outlets", () => {
  it("renderiza no venore-slime (ThemeRenderer/kit): content.before em ordem, falha e timeout isolados", async () => {
    const { normalizeThemeDefinition } = await import("./normalize-entry");
    const { resolveThemeOutletsFrom } = await import("./resolve-theme-outlets");
    const { ThemeRenderer } = await import("./theme-renderer");
    const theme = normalizeThemeDefinition("venore-slime", venoreSlimeTheme, ["venore-slime"]);
    const outlets = resolveThemeOutletsFrom(FIXTURE_REGISTRY, ACTIVE, ctx("/blog/ola"), theme, FAST_TIMEOUT_MS);
    const html = await ssr(
      <ThemeRenderer model={await modelFor(theme, outlets)}>
        <p>conteúdo</p>
      </ThemeRenderer>,
    );
    expect(html).toContain('data-outlet="content.before"');
    expect(html).toContain('data-outlet="content.after"');
    expectOrdered(html, ["early", "banner", "late"]);
    expect(html.indexOf('data-fixture-outlet="late"')).toBeLessThan(html.indexOf("<p>conteúdo</p>"));
    expect(html.indexOf("<p>conteúdo</p>")).toBeLessThan(html.indexOf('data-fixture-outlet="after"'));
    expect(html).toContain('data-fixture-outlet="blog-only"');
    expect(html).not.toContain("admin-only");
    expect(html).not.toContain("fixture outlet explodiu");
    expect(html).not.toContain('data-fixture-outlet="slow"');
    expect(html).toContain("<header");
    expect(html).toContain("<footer");
  });

  it("renderiza num tema v8 de fixture, inclusive no outlet de uma região custom (footer.top)", async () => {
    const { normalizeThemeDefinition } = await import("./normalize-entry");
    const { resolveThemeOutletsFrom } = await import("./resolve-theme-outlets");
    const { ThemeRenderer } = await import("./theme-renderer");
    const theme = normalizeThemeDefinition("fixture-outlets-theme", fixtureV8Theme, ["fixture-outlets-theme"]);
    expect(theme.replacedRegions).toEqual(["footer"]);
    const outlets = resolveThemeOutletsFrom(FIXTURE_REGISTRY, ACTIVE, ctx("/blog/ola"), theme, FAST_TIMEOUT_MS);
    const html = await ssr(
      <ThemeRenderer model={await modelFor(theme, outlets)}>
        <p>conteúdo</p>
      </ThemeRenderer>,
    );
    expectOrdered(html, ["early", "banner", "late", "after"]);
    expect(html).toContain("data-fixture-footer");
    expect(html).toContain('data-outlet="footer.top"');
    expect(html).toContain('data-fixture-outlet="footer-note"');
    expect(html.indexOf('data-fixture-outlet="footer-note"')).toBeLessThan(html.indexOf("rodapé da fixture"));
  });

  it("o adapter 7.x renderiza content.before/content.after (e só esses)", async () => {
    const { normalizeRegistryEntry } = await import("./normalize-entry");
    const { resolveThemeOutletsFrom } = await import("./resolve-theme-outlets");
    const { LegacyShellAdapter } = await import("./legacy-shell-adapter");
    const theme = normalizeRegistryEntry({
      contract: 7,
      manifest: { ...venoreSlimeManifest, key: "legacy-fixture", themeContractVersion: "7.0.0" },
      Shell: SlimeShell,
      colorPalettes: [],
      packageVersion: "1.0.0",
      packageName: "@venore/theme-legacy-fixture",
    });
    expect(theme.outletsRendered).toEqual(LEGACY_THEME_OUTLETS);
    const outlets = resolveThemeOutletsFrom(FIXTURE_REGISTRY, ACTIVE, ctx("/blog/ola"), theme, FAST_TIMEOUT_MS);
    expect(outlets["footer.top"]).toBeUndefined();
    const html = await ssr(
      <LegacyShellAdapter model={await modelFor(theme, outlets)}>
        <p>conteúdo</p>
      </LegacyShellAdapter>,
    );
    expectOrdered(html, ["early", "banner", "late", "after"]);
    expect(html.indexOf('data-fixture-outlet="late"')).toBeLessThan(html.indexOf("<p>conteúdo</p>"));
    expect(html).not.toContain("footer-note");
    expect(html).not.toContain("fixture outlet explodiu");
  });
});
