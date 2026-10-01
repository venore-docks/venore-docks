import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_PAGE_LAYOUT,
  defaultThemeConfigDocument,
  type ContextualBarData,
  type ThemeRenderModel,
} from "@/contexts/themes/contracts/v8";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { Shell } from "./components/Shell";
import { venoreSlimeTheme } from "./theme";
import { PARITY_CONTEXTUAL_MENU, PARITY_PLUGIN_NODE, SLIME_PARITY_SCENARIOS, normalizeParityHtml, type ParityScenario } from "./parity.fixtures";

// Snapshot de paridade do venore-slime (spec v8 §12, Fase F passo 0). Gravado ANTES de mover os
// componentes pro kit; depois da mudança o mesmo arquivo de snapshot de cada cenário precisa bater
// byte a byte (após o normalizador, que só tira data-region/data-outlet/data-block*) — pelo Shell
// reexportado E pelo caminho v8 (ThemeRenderer + layout "topbar" do kit).
vi.mock("next/navigation", () => ({ usePathname: () => "/blog" }));
vi.mock("@/contexts/cms", () => ({ getContextualMenu: async () => ({ success: true, data: [] }) }));
vi.mock("@/plugins/route-registry", () => ({ PLUGIN_ROUTE_TABLES: {} }));

const content = <p>Conteúdo da página</p>;

describe("venore-slime — paridade do Shell", () => {
  for (const scenario of SLIME_PARITY_SCENARIOS) {
    it(`Shell: ${scenario.name}`, async () => {
      const html = normalizeParityHtml(renderToStaticMarkup(<Shell {...scenario.props}>{content}</Shell>));
      await expect(html).toMatchFileSnapshot(`./__parity__/${scenario.name}.html`);
    });
  }
});

async function modelFor(scenario: ParityScenario): Promise<ThemeRenderModel> {
  const { normalizeThemeDefinition } = await import("@/platform/theme-rendering/normalize-entry");
  const { toContextualMenuItemView } = await import("@/platform/theme-rendering/resolve-contextual-bar");
  const theme = normalizeThemeDefinition("venore-slime", venoreSlimeTheme, ["venore-slime"]);
  const contextual: ContextualBarData =
    scenario.contextual === "menu"
      ? { source: "menu", scopePath: "/rh", items: PARITY_CONTEXTUAL_MENU.map(toContextualMenuItemView) }
      : scenario.contextual === "plugin"
        ? { source: "plugin", pluginKey: "x", node: PARITY_PLUGIN_NODE }
        : { source: "none" };
  return {
    pathname: "/blog",
    area: "public",
    theme,
    config: { ...defaultThemeConfigDocument(), revisionId: null, publishedAt: null, source: "legacy-synthesis" },
    section: null,
    options: { values: {}, media: {}, ignored: [] },
    fonts: { classNames: "", css: "" },
    locale: "pt-BR",
    dir: "ltr",
    htmlAttributes: {},
    runtimeCss: "",
    override: null,
    diagnostics: { source: "legacy-synthesis", fallback: null, ignoredOptions: [], section: null },
    slotProps: { header: scenario.props.header, footer: scenario.props.footer, sidebarLeft: scenario.props.sidebarLeft },
    breadcrumbs: scenario.props.breadcrumbs,
    breadcrumbsJsonLd: scenario.props.breadcrumbsJsonLd,
    contextual,
    outlets: {},
    strings: KIT_STRINGS_PT_BR,
    page: DEFAULT_PAGE_LAYOUT,
    maintenance: false,
  };
}

describe("venore-slime — paridade do caminho v8 (ThemeRenderer, layout topbar)", () => {
  for (const scenario of SLIME_PARITY_SCENARIOS) {
    it(`ThemeRenderer: ${scenario.name}`, async () => {
      const { ThemeRenderer } = await import("@/platform/theme-rendering/theme-renderer");
      const model = await modelFor(scenario);
      const html = normalizeParityHtml(renderToStaticMarkup(<ThemeRenderer model={model}>{content}</ThemeRenderer>));
      await expect(html).toMatchFileSnapshot(`./__parity__/${scenario.name}.html`);
    });
  }

  it("as regiões do kit carregam os marcadores data-region (removidos só pelo normalizador)", async () => {
    const { ThemeRenderer } = await import("@/platform/theme-rendering/theme-renderer");
    const model = await modelFor(SLIME_PARITY_SCENARIOS.find((scenario) => scenario.name === "contextual-menu")!);
    const html = renderToStaticMarkup(<ThemeRenderer model={model}>{content}</ThemeRenderer>);
    for (const region of ["header", "rail", "content", "contextual", "footer"]) {
      expect(html).toContain(`data-region="${region}"`);
    }
  });
});

describe("LegacyShellAdapter (7.x)", () => {
  it("passa breadcrumbsJsonLd=null pro Shell e renderiza o JSON-LD no core, escapado", async () => {
    const { LegacyShellAdapter } = await import("@/platform/theme-rendering/legacy-shell-adapter");
    const scenario = SLIME_PARITY_SCENARIOS.find((candidate) => candidate.name === "breadcrumbs-json-ld")!;
    const received: unknown[] = [];
    const SpyShell = (props: Parameters<typeof Shell>[0]) => {
      received.push(props.breadcrumbsJsonLd);
      return <Shell {...props} />;
    };
    const model = await modelFor(scenario);
    const html = renderToStaticMarkup(
      <LegacyShellAdapter model={{ ...model, theme: { ...model.theme, contract: 7, legacyShell: SpyShell } }}>{content}</LegacyShellAdapter>,
    );
    expect(received).toEqual([null]);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).not.toMatch(/<\/script><b>/);
    expect(html).toContain("\\u003c/script\\u003e");
  });

  it.each(SLIME_PARITY_SCENARIOS.filter((scenario) => !scenario.props.breadcrumbsJsonLd))(
    "Shell do slime via adapter = snapshot: $name",
    async (scenario) => {
      const { LegacyShellAdapter } = await import("@/platform/theme-rendering/legacy-shell-adapter");
      const model = await modelFor(scenario);
      const html = normalizeParityHtml(
        renderToStaticMarkup(
          <LegacyShellAdapter model={{ ...model, theme: { ...model.theme, contract: 7, legacyShell: Shell } }}>{content}</LegacyShellAdapter>,
        ),
      );
      await expect(html).toMatchFileSnapshot(`./__parity__/${scenario.name}.html`);
    },
  );
});
