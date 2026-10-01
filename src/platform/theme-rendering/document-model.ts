import { cache } from "react";
import { headers } from "next/headers";
import { getPublishedThemeConfig } from "@/contexts/themes";
import {
  defaultThemeConfigDocument,
  type DocumentModel,
  type PublishedThemeConfig,
  type ThemeRenderDiagnostics,
} from "@/contexts/themes/contracts/v8";
import { BREADCRUMB_PATHNAME_HEADER } from "@/platform/breadcrumbs/pathname-header";
import { areaForPathname } from "./area";
import { buildPaletteCss } from "./resolve-active-color-palette";
import { buildOptionsCssAndAttrs } from "./build-options-css";
import { matchSectionOverride } from "./match-section-override";
import { loadOverrideThemeConfig, readThemeOverride } from "./read-theme-override";
import { loadThemeEnabledCheck } from "./theme-enabled-check";
import { resolveDocumentFonts } from "./resolve-document-fonts";
import { resolveDocumentLocale } from "./resolve-document-locale";
import { FALLBACK_THEME_KEY, resolveThemeDefinition } from "./resolve-theme-definition";
import { resolveThemeOptions } from "./resolve-theme-options";

export { areaForPathname };

function slimeDefaultConfig(): PublishedThemeConfig {
  return { ...defaultThemeConfigDocument(FALLBACK_THEME_KEY), revisionId: null, publishedAt: null, source: "legacy-synthesis" };
}

// Modelo do documento (<html>) por request — spec §6, passos 1-12. Congelado depois da Fase F:
// toda variação mora atrás dos resolvers (cada um com dono). cache() memoiza por request (root
// layout e (platform)/layout chamam os dois).
export const resolveDocumentModel = cache(async (): Promise<DocumentModel> => {
  // 1 caminho e área
  const pathname = (await headers()).get(BREADCRUMB_PATHNAME_HEADER);
  const area = areaForPathname(pathname);

  // 2 runbook: THEME_FORCE_FALLBACK=1 ⇒ slime com padrões, sem ler config
  const forced = process.env.THEME_FORCE_FALLBACK === "1";

  // 3 override (W6) — 4 config publicada (rascunho via override: W6)
  const override = forced ? null : await readThemeOverride({ pathname, area });
  let configReadFailed = false;
  let config: PublishedThemeConfig;
  if (forced) {
    config = slimeDefaultConfig();
  } else {
    // Rascunho em preview (W6): a config do rascunho apontado pelo cookie, senão a publicada.
    const published = await loadOverrideThemeConfig(override, getPublishedThemeConfig);
    configReadFailed = !published.success;
    config = published.success ? published.data : slimeDefaultConfig();
  }

  // 5 seção (W6) — 6 chave do tema
  const section = forced ? null : matchSectionOverride(config.sections, pathname, area);
  const themeKey = forced || override?.kind === "safe-mode" ? FALLBACK_THEME_KEY : (section?.themeKey ?? config.themeKey);

  // 7 definição (registro → faixa → normaliza → herança)
  // Seção que troca de tema (W6): o tema da seção precisa estar habilitado (o ativo nunca está
  // desabilitado — toggle-theme-enabled impede —, então só a seção paga a leitura do estado).
  const isEnabled = section?.themeKey && section.themeKey === themeKey ? await loadThemeEnabledCheck() : undefined;
  const { theme, fallback } = resolveThemeDefinition(themeKey, { isEnabled });
  const stored = config.byTheme[theme.key];

  // 8 opções (W2) — 9 paleta (W1) — 10 CSS/atributos de opção (W2) — 11 fontes (W8) — 12 locale (W8)
  const options = resolveThemeOptions(theme, stored?.options, section?.options);
  const paletteCss = buildPaletteCss(theme, section?.palette ?? stored?.palette);
  const optionsOutput = buildOptionsCssAndAttrs(theme.options, options, { themeKey: theme.key });
  const fonts = resolveDocumentFonts(theme, stored?.fonts, options, area);
  const { locale, dir } = await resolveDocumentLocale();

  const diagnostics: ThemeRenderDiagnostics = {
    source: forced ? "forced-fallback" : override?.kind === "safe-mode" ? "safe-mode" : override?.kind === "draft" ? "draft" : config.source,
    fallback: forced ? { reason: "forced" } : configReadFailed ? { reason: "config-read-failed" } : fallback,
    ignoredOptions: options.ignored,
    section: section?.id ?? null,
  };

  return {
    pathname,
    area,
    theme,
    config,
    section,
    options,
    fonts,
    locale,
    dir,
    htmlAttributes: optionsOutput.attributes,
    runtimeCss: [paletteCss, optionsOutput.css, fonts.css].filter((css) => css.length > 0).join("\n"),
    override,
    diagnostics,
  };
});
