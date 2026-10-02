import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_PAGE_LAYOUT,
  defaultThemeConfigDocument,
  type ContextualBarData,
  type ThemeRenderModel,
} from "@/contexts/themes/contracts/v8";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";
import { Shell } from "@/themes/venore-slime/components/Shell";
import { venoreSlimeTheme } from "@/themes/venore-slime/theme";
import {
  PARITY_CONTEXTUAL_MENU,
  PARITY_PLUGIN_NODE,
  SLIME_PARITY_SCENARIOS,
  normalizeParityHtml,
  type ParityScenario,
} from "@/themes/venore-slime/parity.fixtures";

// Paridade do caminho v8 contra os snapshots do passo 0 (src/themes/venore-slime/__parity__/):
// ThemeRenderer com o layout "topbar" do kit e LegacyShellAdapter com o Shell do slime precisam
// produzir o MESMO HTML que o Shell 7.x produzia antes da Fase F.
vi.mock("next/navigation", () => ({ usePathname: () => "/blog" }));
vi.mock("@/contexts/cms", () => ({ getContextualMenu: async () => ({ success: true, data: [] }) }));
vi.mock("@/plugins/route-registry", () => ({ PLUGIN_ROUTE_TABLES: {} }));

const PARITY_DIR = "../../themes/venore-slime/__parity__";
const content = <p>Conteúdo da página</p>;

async function modelFor(scenario: ParityScenario): Promise<ThemeRenderModel> {
  const { normalizeThemeDefinition } = await import("./normalize-entry");
  const { toContextualMenuItemView } = await import("./resolve-contextual-bar");
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
      const { ThemeRenderer } = await import("./theme-renderer");
      const model = await modelFor(scenario);
      const html = normalizeParityHtml(renderToStaticMarkup(<ThemeRenderer model={model}>{content}</ThemeRenderer>));
      await expect(html).toMatchFileSnapshot(`${PARITY_DIR}/${scenario.name}.html`);
    });
  }

  it("as regiões do kit carregam os marcadores data-region (removidos só pelo normalizador)", async () => {
    const { ThemeRenderer } = await import("./theme-renderer");
    const model = await modelFor(SLIME_PARITY_SCENARIOS.find((scenario) => scenario.name === "contextual-menu")!);
    const html = renderToStaticMarkup(<ThemeRenderer model={model}>{content}</ThemeRenderer>);
    for (const region of ["header", "rail", "content", "contextual", "footer"]) {
      expect(html).toContain(`data-region="${region}"`);
    }
  });
});

describe("LegacyShellAdapter (7.x)", () => {
  it("passa breadcrumbsJsonLd=null pro Shell e renderiza o JSON-LD no core, escapado", async () => {
    const { LegacyShellAdapter } = await import("./legacy-shell-adapter");
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
      const { LegacyShellAdapter } = await import("./legacy-shell-adapter");
      const model = await modelFor(scenario);
      const html = normalizeParityHtml(
        renderToStaticMarkup(
          <LegacyShellAdapter model={{ ...model, theme: { ...model.theme, contract: 7, legacyShell: Shell } }}>{content}</LegacyShellAdapter>,
        ),
      );
      await expect(html).toMatchFileSnapshot(`${PARITY_DIR}/${scenario.name}.html`);
    },
  );
});
