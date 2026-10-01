import type { ResolvedThemeDefinition, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { KIT_STRINGS_PT_BR } from "@/theme-sdk/kit/i18n/t";

// Strings do request (spec §7.11): kit[locale] + mensagens da cadeia do tema, com fallback
// idioma → pt-BR → chave. Dono: W8 — na Fase F, o catálogo pt-BR do kit (texto de hoje).
export function resolveThemeStrings(theme: ResolvedThemeDefinition, locale: string): ThemeStrings {
  void theme;
  void locale;
  return KIT_STRINGS_PT_BR;
}
