import type { ReactNode } from "react";
import {
  DEFAULT_PAGE_LAYOUT,
  defaultThemeConfigDocument,
  type ContextualBarData,
  type ResolvedThemeDefinition,
  type ThemeRenderModel,
  type ThemeSectionOverride,
} from "@/contexts/themes/contracts/v8";
import { LegacyShellAdapter } from "@/platform/theme-rendering/legacy-shell-adapter";
import { buildOptionsCssAndAttrs } from "@/platform/theme-rendering/build-options-css";
import { buildPaletteCss } from "@/platform/theme-rendering/resolve-active-color-palette";
import { resolveDocumentFonts } from "@/platform/theme-rendering/resolve-document-fonts";
import { toKitAdminDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { resolveThemeOptions } from "@/platform/theme-rendering/resolve-theme-options";
import { resolveThemeStrings } from "@/platform/theme-rendering/resolve-theme-strings";
import { ThemeRenderer } from "@/platform/theme-rendering/theme-renderer";
import {
  FIXTURE_CONTEXTUAL_MENU,
  fixtureOutletNodes,
  fixturePluginContextualNode,
  type ThemeFixtureScenario,
} from "./fixtures";

// Modelo de render a partir de um cenário de fixture (spec v8 §7.13/§10): o MESMO pipeline puro do
// documento (opções W2 → paleta W1 → CSS/atributos de opção W2 → fontes W8 → strings W8), só que
// com dado fixo em vez de request/banco. Galeria e harness de CI montam o tema por aqui.

export type FixtureSlotActions = {
  onSignOut: () => Promise<void>;
  onToggleNavMode: () => Promise<void>;
  onToggleCollapsed: () => Promise<void>;
};

export type FixtureModelOptions = {
  // Seletor no lugar de `html[data-theme="k"]` no CSS de runtime (galeria: `[data-gallery-root]`).
  scope?: string;
  // Num Server Component (galeria) as callbacks das regiões client precisam ser server actions —
  // os no-ops dos fixtures só servem pro SSR puro do harness.
  actions?: FixtureSlotActions;
};

export function fixtureContextualBar(kind: ThemeFixtureScenario["contextual"]): ContextualBarData {
  if (kind === "menu") return { source: "menu", scopePath: "/rh", items: FIXTURE_CONTEXTUAL_MENU };
  if (kind === "plugin") return { source: "plugin", pluginKey: "fixture", node: fixturePluginContextualNode() };
  return { source: "none" };
}

function fixtureSection(scenario: ThemeFixtureScenario): ThemeSectionOverride | null {
  if (!scenario.arrangement || scenario.area === "admin") return null;
  return { id: `fixture-${scenario.name}`, label: scenario.label, pathPrefix: scenario.pathname, ...scenario.arrangement };
}

// O CSS de fonte (resolveDocumentFonts) não tem parâmetro de escopo: o seletor é trocado aqui pelo
// mesmo escopo dos builders de paleta/opções.
function scopeFontsCss(css: string, themeKey: string, scope: string | undefined): string {
  if (!css || scope === undefined) return css;
  return css.split(`html[data-theme="${themeKey}"]`).join(`${scope}[data-theme="${themeKey}"]`);
}

function withActions(slots: ThemeFixtureScenario["slots"], actions: FixtureSlotActions | undefined): ThemeRenderModel["slotProps"] {
  if (!actions) return { header: slots.header, footer: slots.footer, sidebarLeft: slots.sidebarLeft };
  return {
    header: { ...slots.header, onSignOut: actions.onSignOut },
    footer: slots.footer,
    sidebarLeft: { ...slots.sidebarLeft, onToggleNavMode: actions.onToggleNavMode, onToggleCollapsed: actions.onToggleCollapsed },
  };
}

export function buildFixtureRenderModel(theme: ResolvedThemeDefinition, scenario: ThemeFixtureScenario, options: FixtureModelOptions = {}): ThemeRenderModel {
  const { area, locale, dir } = scenario;
  const section = fixtureSection(scenario);
  const resolvedOptions = resolveThemeOptions(theme, undefined, section?.options);
  const paletteCss = buildPaletteCss(theme, undefined, { scope: options.scope });
  const optionsOutput = buildOptionsCssAndAttrs(theme.options, resolvedOptions, { themeKey: theme.key, scope: options.scope, area });
  const fonts = resolveDocumentFonts(theme, undefined, resolvedOptions, area);
  const fontsCss = scopeFontsCss(fonts.css, theme.key, options.scope);

  return {
    pathname: scenario.pathname,
    area,
    theme,
    config: { ...defaultThemeConfigDocument(theme.key), revisionId: null, publishedAt: null, source: "legacy-synthesis" },
    section,
    options: resolvedOptions,
    fonts: { classNames: fonts.classNames, css: fontsCss },
    locale,
    dir,
    htmlAttributes: optionsOutput.attributes,
    runtimeCss: [paletteCss, optionsOutput.css, fontsCss].filter((css) => css.length > 0).join("\n"),
    override: null,
    diagnostics: { source: "legacy-synthesis", fallback: null, ignoredOptions: resolvedOptions.ignored, section: section?.id ?? null },
    slotProps: withActions(scenario.slots, options.actions),
    breadcrumbs: scenario.slots.breadcrumbs,
    breadcrumbsJsonLd: scenario.slots.breadcrumbsJsonLd,
    contextual: fixtureContextualBar(scenario.contextual),
    outlets: scenario.outlets ? fixtureOutletNodes() : {},
    strings: resolveThemeStrings(theme, locale),
    page: { ...DEFAULT_PAGE_LAYOUT, ...scenario.page },
    maintenance: false,
  };
}

// Mesma escolha do (platform)/layout: 7.x ⇒ Shell do pacote (público e admin); v8 no admin ⇒ kit
// topbar só com cores/marca do tema (invariante §0.5); v8 no site ⇒ ThemeRenderer.
export function FixtureShell({ model, nonce, children }: { model: ThemeRenderModel; nonce?: string; children: ReactNode }) {
  if (model.theme.legacyShell) {
    return (
      <LegacyShellAdapter model={model} nonce={nonce}>
        {children}
      </LegacyShellAdapter>
    );
  }
  const rendered = model.area === "admin" ? { ...model, theme: toKitAdminDefinition(model.theme) } : model;
  return (
    <ThemeRenderer model={rendered} nonce={nonce}>
      {children}
    </ThemeRenderer>
  );
}
