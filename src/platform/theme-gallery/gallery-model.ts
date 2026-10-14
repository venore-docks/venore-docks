import type { Block, Composition } from "@/contexts/cms";
import type { ResolvedThemeDefinition, ThemeRenderDiagnostics, ThemeTemplateKey, ThemeTokenRegion } from "@/contexts/themes/contracts/v8";
import { THEME_TEMPLATE_KEYS, THEME_TOKEN_REGIONS } from "@/contexts/themes/contracts/v8";
import { listBlockDefinitions } from "@/platform/page-builder/block-registry";
import { SECTION_BLOCK_KEY } from "@/platform/page-builder/blocks/section";
import { availableSectionStyles } from "@/platform/page-builder/with-theme-presentation-fields";
import { checkRegionContrast, type RegionContrastProblem } from "@/platform/theme-engine/contrast";
import { resolveThemeText, toSchemaFormFields, toSchemaFormValues } from "@/platform/theme-engine/theme-options";
import { effectiveTokens, getThemeTokenValues } from "@/platform/theme-engine/token-values";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { KIT_MESSAGES } from "@/theme-sdk/kit/i18n/catalogs";
import { THEME_REGISTRY } from "@/themes/registry";
import { buildFixtureRenderModel } from "./fixture-model";
import { findFixtureScenario, THEME_FIXTURE_SCENARIOS } from "./fixtures";

// Dado da galeria viva (/admin/themes/gallery, spec v8 §7.13): qualquer tema do registro renderizado
// SEM ativar — nada aqui grava (nem settings, nem cookie). O CSS de runtime sai dos builders do W1
// (paleta) e W2 (opções) com `scope`, então só vale dentro de `[data-gallery-root]`; o resto do
// admin continua no tema ativo.

export const GALLERY_SCOPE = "[data-gallery-root]";
export const GALLERY_FRAME_WIDTHS = [390, 1280] as const;

export type GalleryMode = "light" | "dark";
export type GallerySearchParams = { theme?: string | string[]; mode?: string | string[]; locale?: string | string[]; dir?: string | string[] };
export type GallerySelection = { themeKey: string; mode: GalleryMode; locale: string; dir: "ltr" | "rtl" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const GALLERY_LOCALES: readonly string[] = Object.keys(KIT_MESSAGES);
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

// Parâmetro desconhecido nunca quebra: tema fora do registro → o ativo; modo fora dos colorModes
// do tema → o primeiro declarado; locale fora dos catálogos → pt-BR; dir segue o idioma.
export function parseGallerySelection(params: GallerySearchParams, activeKey: string | null): GallerySelection {
  const requested = first(params.theme);
  const themeKey = requested && THEME_REGISTRY[requested] ? requested : activeKey && THEME_REGISTRY[activeKey] ? activeKey : "venore-slime";
  const modes = THEME_REGISTRY[themeKey].manifest.colorModes;
  const requestedMode = first(params.mode);
  const mode: GalleryMode = requestedMode === "dark" || requestedMode === "light" ? requestedMode : "light";
  const locale = GALLERY_LOCALES.includes(first(params.locale) ?? "") ? first(params.locale)! : "pt-BR";
  const requestedDir = first(params.dir);
  const dir = requestedDir === "rtl" || requestedDir === "ltr" ? requestedDir : RTL_LANGUAGES.has(locale.split("-")[0]) ? "rtl" : "ltr";
  return { themeKey, mode: modes.includes(mode) ? mode : modes[0], locale, dir };
}

export function gallerySearch(selection: GallerySelection, patch: Partial<GallerySelection> = {}): string {
  const next = { ...selection, ...patch };
  const search = new URLSearchParams({ theme: next.themeKey, mode: next.mode, locale: next.locale, dir: next.dir });
  return `?${search.toString()}`;
}

export type GalleryOptionRow = { key: string; label: string; type: string; defaultValue: string };
export type GalleryTokenRow = { name: string; light: string | null; dark: string | null };
export type GalleryBlockSample = { id: string; label: string; variant: string | null; sectionStyle: string | null; blocks: Composition };
export type GalleryTemplateSample = { key: ThemeTemplateKey; variants: string[] };

export type GalleryModel = {
  selection: GallerySelection;
  theme: ResolvedThemeDefinition;
  fallback: ThemeRenderDiagnostics["fallback"];
  // Atributos da raiz `<div data-gallery-root>`: data-theme, classe dark, dir, lang, data-opt-*.
  rootAttributes: Record<string, string>;
  rootClassName: string;
  // CSS de runtime com escopo (paleta W1 + opções W2 + fontes W8) — nunca toca o <html> do admin.
  scopedCss: string;
  tokens: GalleryTokenRow[];
  contrast: { region: ThemeTokenRegion; mode: GalleryMode; problems: RegionContrastProblem[] }[];
  options: GalleryOptionRow[];
  templates: GalleryTemplateSample[];
  blocks: GalleryBlockSample[];
};

function formatOptionDefault(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function blockFactory() {
  let id = 0;
  return (key: string, data: Record<string, unknown>, areas: Block["areas"] = []): Block => {
    id += 1;
    return { id: `gallery-${id}`, key, slot: "main", htmlId: null, data, areas };
  };
}

// Todo bloco folha do core com o dado padrão; depois cada variante que o tema declara; depois uma
// seção por estilo de seção (canônicos + extras do tema − ocultos), com título e texto dentro.
export function buildGalleryBlockSamples(theme: ResolvedThemeDefinition, locale: string): GalleryBlockSample[] {
  const block = blockFactory();
  const definitions = listBlockDefinitions(new Set());
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const samples: GalleryBlockSample[] = [];
  for (const definition of definitions) {
    if (definition.structure !== "leaf" || !definition.key.startsWith("core.")) continue;
    samples.push({ id: definition.key, label: definition.label, variant: null, sectionStyle: null, blocks: [block(definition.key, { ...definition.defaultData })] });
    for (const variant of theme.pageBuilder.blockVariants[definition.key] ?? []) {
      samples.push({
        id: `${definition.key}:${variant.value}`,
        label: `${definition.label} — ${resolveThemeText(variant.label, theme.messages, locale) || variant.value}`,
        variant: variant.value,
        sectionStyle: null,
        blocks: [block(definition.key, { ...definition.defaultData, presentationVariant: variant.value })],
      });
    }
  }
  const section = byKey.get(SECTION_BLOCK_KEY);
  const heading = byKey.get("core.content.heading");
  const richtext = byKey.get("core.content.richtext");
  if (section) {
    for (const style of availableSectionStyles(theme.pageBuilder)) {
      const children = [
        ...(heading ? [block(heading.key, { ...heading.defaultData, text: `Seção “${style}”` })] : []),
        ...(richtext ? [block(richtext.key, { ...richtext.defaultData })] : []),
      ];
      samples.push({
        id: `${SECTION_BLOCK_KEY}:${style}`,
        label: `Seção — estilo ${style}`,
        variant: null,
        sectionStyle: style,
        blocks: [block(SECTION_BLOCK_KEY, { ...section.defaultData, sectionStyle: style, title: "" }, [{ key: "content", blocks: children }])],
      });
    }
  }
  return samples;
}

export type BuildGalleryModelInput = {
  selection: GallerySelection;
  // Estado habilitado (listExtensionStates). Desabilitado ⇒ fallback com diagnóstico, como no render.
  isEnabled?: (themeKey: string) => boolean;
};

export function buildGalleryModel({ selection, isEnabled }: BuildGalleryModelInput): GalleryModel {
  const { theme, fallback } = resolveThemeDefinition(selection.themeKey, { isEnabled });
  const base = findFixtureScenario("logged-in") ?? THEME_FIXTURE_SCENARIOS[0];
  const model = buildFixtureRenderModel(theme, { ...base, locale: selection.locale, dir: selection.dir }, { scope: GALLERY_SCOPE });

  const values = getThemeTokenValues(theme.key);
  const effective = effectiveTokens(values, null);
  const names = [...new Set([...Object.keys(effective.light), ...Object.keys(effective.dark)])].sort();
  const problems = checkRegionContrast(effective, { regions: theme.manifest.palette?.regions });
  const contrast = (["light", "dark"] as const).flatMap((mode) =>
    THEME_TOKEN_REGIONS.map((region) => ({ region, mode, problems: problems.filter((problem) => problem.region === region && problem.mode === mode) })),
  );

  const fields = toSchemaFormFields({ options: theme.options, messages: theme.messages, fontChoices: theme.fontChoices }, selection.locale);
  const defaults = toSchemaFormValues(theme.options, undefined);
  const options = theme.options.map((field, index) => ({
    key: field.key,
    label: fields[index]?.label ?? field.key,
    type: field.type,
    defaultValue: formatOptionDefault(defaults[fields[index]?.name ?? ""]),
  }));

  const templates = THEME_TEMPLATE_KEYS.map((key) => ({ key, variants: Object.keys(theme.templates[key]).sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b))) }));

  return {
    selection,
    theme,
    fallback,
    rootAttributes: {
      "data-gallery-root": "",
      "data-theme": theme.key,
      dir: selection.dir,
      lang: selection.locale,
      ...model.htmlAttributes,
    },
    rootClassName: [selection.mode === "dark" ? "dark" : "", model.fonts.classNames].filter(Boolean).join(" "),
    scopedCss: model.runtimeCss,
    tokens: names.map((name) => ({ name, light: effective.light[name] ?? null, dark: effective.dark[name] ?? null })),
    contrast,
    options,
    templates,
    blocks: buildGalleryBlockSamples(theme, selection.locale),
  };
}
