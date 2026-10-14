import { isReservedSectionPrefix } from "@/contexts/themes";
import {
  type ResolvedThemeDefinition,
  type ThemeConfigByTheme,
  type ThemeConfigDocument,
  type ThemeOptionValue,
  type ThemePaletteChoice,
  type ThemeSectionOverride,
  type ThemeTemplateKey,
} from "@/contexts/themes/contracts/v8";
import { resolveThemeDefinition } from "@/platform/theme-rendering/resolve-theme-definition";
import { THEME_REGISTRY, type ThemeRegistryEntry } from "@/themes/registry";
import { normalizePathPrefix } from "@/shared/normalize-path-prefix";
// Validador único de valor de opção (zod, W2) — o mesmo que o render usa: o que a escrita aceita
// é exatamente o que resolveThemeOptions aplica.
import { isReservedThemeOptionKey, isValidOptionValue, isValidReservedOptionValue } from "./theme-options";

export type ThemeConfigValidationContext = {
  registry?: Record<string, ThemeRegistryEntry>;
  // Estado de habilitação dos temas (contexts/extensions); omitido ⇒ todos habilitados.
  isEnabled?: (themeKey: string) => boolean;
};
export type ThemeConfigValidationError = { code: string; message: string };
export type ThemeConfigValidation = {
  // O documento limpo: o que não se aplica ao registro local foi descartado (com aviso).
  config: ThemeConfigDocument;
  warnings: string[];
  // Não-vazio ⇒ o documento não pode ser salvo/publicado como está.
  errors: ThemeConfigValidationError[];
};

function cleanOptions(
  theme: ResolvedThemeDefinition,
  options: Readonly<Record<string, ThemeOptionValue>>,
  where: string,
  warnings: string[],
): Record<string, ThemeOptionValue> {
  const fields = new Map(theme.options.map((field) => [field.key, field]));
  const cleaned: Record<string, ThemeOptionValue> = {};
  for (const [key, value] of Object.entries(options)) {
    if (isReservedThemeOptionKey(key)) {
      if (isValidReservedOptionValue(theme, key, value)) cleaned[key] = value;
      else warnings.push(`${where}: valor "${String(value)}" da opção "${key}" não é oferecido pelo tema ${theme.key} — descartado.`);
      continue;
    }
    const field = fields.get(key);
    if (!field) {
      warnings.push(`${where}: opção desconhecida "${key}" no tema ${theme.key} — descartada.`);
      continue;
    }
    if (!isValidOptionValue(field, value)) {
      warnings.push(`${where}: valor inválido para a opção "${key}" — descartado (vale o padrão do tema).`);
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

function cleanPalette(theme: ResolvedThemeDefinition, palette: ThemePaletteChoice, where: string, warnings: string[]): ThemePaletteChoice {
  if (palette.mode === "preset" && !theme.colorPalettes.some((candidate) => candidate.id === palette.presetId)) {
    warnings.push(`${where}: paleta "${palette.presetId}" não existe no tema ${theme.key} — volta para a paleta padrão.`);
    return { mode: "default" };
  }
  if ((palette.mode === "custom" || palette.mode === "seed") && theme.palette.allowCustom === false) {
    warnings.push(`${where}: o tema ${theme.key} não aceita paleta personalizada — volta para a paleta padrão.`);
    return { mode: "default" };
  }
  return palette;
}

function cleanTemplates(
  theme: ResolvedThemeDefinition,
  templates: NonNullable<ThemeSectionOverride["templates"]>,
  where: string,
  warnings: string[],
): NonNullable<ThemeSectionOverride["templates"]> {
  const cleaned: NonNullable<ThemeSectionOverride["templates"]> = {};
  for (const [key, variant] of Object.entries(templates) as [ThemeTemplateKey, string][]) {
    const offered = (theme.templateVariants[key] ?? []).map((choice) => choice.value);
    if (variant === "default" || offered.includes(variant)) cleaned[key] = variant;
    else warnings.push(`${where}: variante "${variant}" do template "${key}" não existe no tema ${theme.key} — descartada.`);
  }
  return cleaned;
}

// Valida o documento contra o REGISTRO LOCAL de temas (spec §4.3 passo 1, §7.10): é o que
// contexts/themes não pode fazer (não importa src/themes). Tema principal ausente, desabilitado ou
// fora do range de contrato é erro; o resto (tema de seção, opção, paleta, variante) é
// descartado com aviso — o documento resultante só contém o que este site consegue renderizar.
export function validateThemeConfig(input: ThemeConfigDocument, context: ThemeConfigValidationContext = {}): ThemeConfigValidation {
  const registry = context.registry ?? THEME_REGISTRY;
  const isEnabled = context.isEnabled ?? (() => true);
  const warnings: string[] = [];
  const errors: ThemeConfigValidationError[] = [];
  const resolved = new Map<string, ResolvedThemeDefinition | null>();

  const resolve = (key: string): ResolvedThemeDefinition | null => {
    if (!resolved.has(key)) {
      const result = registry[key] ? resolveThemeDefinition(key, { registry, isEnabled }) : null;
      resolved.set(key, result && result.fallback === null ? result.theme : null);
    }
    return resolved.get(key) ?? null;
  };
  const describeUnavailable = (key: string) =>
    !registry[key] ? "não está instalado" : !isEnabled(key) ? "está desabilitado" : "não é compatível com este core";

  const mainTheme = resolve(input.themeKey);
  if (!mainTheme) {
    errors.push({
      code: !registry[input.themeKey] ? "themes.config.unknown_theme" : "themes.config.unavailable_theme",
      message: `O tema "${input.themeKey}" ${describeUnavailable(input.themeKey)}.`,
    });
  }

  const byTheme: Record<string, ThemeConfigByTheme> = {};
  for (const [key, entry] of Object.entries(input.byTheme)) {
    const theme = resolve(key);
    if (!theme) {
      if (key !== input.themeKey) warnings.push(`Configuração do tema "${key}" descartada: o tema ${describeUnavailable(key)}.`);
      continue;
    }
    const where = `Tema ${key}`;
    byTheme[key] = {
      palette: cleanPalette(theme, entry.palette, where, warnings),
      options: cleanOptions(theme, entry.options, where, warnings),
      fonts: entry.fonts,
    };
  }

  const sections: ThemeSectionOverride[] = [];
  for (const section of input.sections) {
    const pathPrefix = normalizePathPrefix(section.pathPrefix);
    if (isReservedSectionPrefix(pathPrefix)) {
      errors.push({
        code: "themes.config.section_reserved_prefix",
        message: `A seção "${section.label}" usa o caminho reservado "${pathPrefix}".`,
      });
      continue;
    }
    const where = `Seção "${section.label}"`;
    const next: ThemeSectionOverride = { ...section, pathPrefix };
    if (section.themeKey && !resolve(section.themeKey)) {
      warnings.push(`${where}: o tema "${section.themeKey}" ${describeUnavailable(section.themeKey)} — a seção usa o tema do site.`);
      delete next.themeKey;
    }
    const sectionTheme = resolve(next.themeKey ?? input.themeKey);
    if (sectionTheme) {
      if (next.options) next.options = cleanOptions(sectionTheme, next.options, where, warnings);
      if (next.palette) next.palette = cleanPalette(sectionTheme, next.palette, where, warnings);
      if (next.templates) next.templates = cleanTemplates(sectionTheme, next.templates, where, warnings);
    }
    sections.push(next);
  }

  return { config: { ...input, byTheme, sections }, warnings, errors };
}
