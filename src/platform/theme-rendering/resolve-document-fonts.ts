import { FONT_ROLES, type FontId, type FontRole, type ResolvedThemeDefinition, type ResolvedThemeOptions } from "@/contexts/themes/contracts/v8";
import { DEFAULT_FONTS, FONT_CATALOG, isFontId } from "@/platform/theme-fonts/catalog";
import { DEFAULT_FONT_CLASS_NAMES, FONT_VARIABLE_CLASS_NAMES } from "@/platform/theme-fonts/registry";

type FontTheme = Pick<ResolvedThemeDefinition, "key" | "fonts" | "fontChoices" | "options">;

// Seleção de fonte por papel (spec §7.6), do mais fraco ao mais forte: manifesto (theme.fonts, já
// com os padrões do normalizador) ← opções do tipo `font` ← config salva (byTheme[k].fonts). Id
// fora da whitelist FONT_IDS — ou fora de `choices` do papel, quando o manifesto declara — é
// ignorado; manifesto com id desconhecido cai no padrão (Geist).
export function selectDocumentFonts(
  theme: FontTheme,
  stored: Partial<Record<FontRole, FontId>> | undefined,
  options: Pick<ResolvedThemeOptions, "values">,
): Record<FontRole, FontId> {
  const allowed = (role: FontRole, id: unknown): id is FontId => {
    if (!isFontId(id)) return false;
    const choices = theme.fontChoices?.[role];
    return !choices || choices.length === 0 || choices.includes(id);
  };

  const selected = {} as Record<FontRole, FontId>;
  for (const role of FONT_ROLES) {
    const manifest = theme.fonts?.[role];
    selected[role] = isFontId(manifest) ? manifest : role === "display" && isFontId(theme.fonts?.sans) ? theme.fonts.sans : DEFAULT_FONTS[role];
  }
  for (const field of theme.options ?? []) {
    if (field.type !== "font") continue;
    const value = options.values[field.key];
    if (allowed(field.role, value)) selected[field.role] = value;
  }
  for (const role of FONT_ROLES) {
    const value = stored?.[role];
    if (allowed(role, value)) selected[role] = value;
  }
  return selected;
}

const SAFE_THEME_KEY = /^[a-z0-9][a-z0-9-]*$/;

// Fontes do documento (spec §7.6). Só as classes `.variable` das fontes escolhidas vão pro <html>
// (sans, mono, display — sem repetir); o CSS de runtime aponta `--theme-font-*` (lido por
// fonts.css) para a variável da família, só para o papel que difere do padrão — Geist puro dá
// CSS vazio, idêntico a antes da v8. Admin sempre Geist.
export function resolveDocumentFonts(
  theme: ResolvedThemeDefinition,
  stored: Partial<Record<FontRole, FontId>> | undefined,
  options: ResolvedThemeOptions,
  area: "public" | "admin",
): { classNames: string; css: string } {
  if (area === "admin") return { classNames: DEFAULT_FONT_CLASS_NAMES, css: "" };
  const fonts = selectDocumentFonts(theme, stored, options);

  const ids = [...new Set<FontId>([fonts.sans, fonts.mono, fonts.display])];
  const classNames = ids.map((id) => FONT_VARIABLE_CLASS_NAMES[id]).join(" ");

  const declarations: string[] = [];
  if (fonts.sans !== DEFAULT_FONTS.sans) declarations.push(`--theme-font-sans:var(${FONT_CATALOG[fonts.sans].cssVariable})`);
  if (fonts.mono !== DEFAULT_FONTS.mono) declarations.push(`--theme-font-mono:var(${FONT_CATALOG[fonts.mono].cssVariable})`);
  // fonts.css: display sem valor = var(--font-sans); só declara quando é outra família.
  if (fonts.display !== fonts.sans) declarations.push(`--theme-font-display:var(${FONT_CATALOG[fonts.display].cssVariable})`);

  const css =
    declarations.length > 0 && SAFE_THEME_KEY.test(theme.key) ? `html[data-theme="${theme.key}"]{${declarations.join(";")}}` : "";
  return { classNames, css };
}
