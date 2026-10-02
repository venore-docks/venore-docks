import type { ResolvedThemeDefinition, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { KIT_MESSAGES, mergeLocaleStrings } from "@/theme-sdk/kit/i18n/catalogs";

// Strings do request (spec §7.11): catálogo do kit[locale] + mensagens da cadeia do tema
// (theme.messages já vem com a herança aplicada), com fallback por chave locale → idioma → pt-BR;
// a chave ausente em tudo é devolvida pelo próprio `t()`. No mesmo degrau, o tema vence o kit.
// Memoizado por definição (objeto estável do registro) + locale: layout, render-model,
// renderTemplate e not-found pedem o mesmo resultado no mesmo request.
const memo = new WeakMap<ResolvedThemeDefinition, Map<string, ThemeStrings>>();

export function resolveThemeStrings(theme: ResolvedThemeDefinition, locale: string): ThemeStrings {
  let byLocale = memo.get(theme);
  if (!byLocale) {
    byLocale = new Map();
    memo.set(theme, byLocale);
  }
  const cached = byLocale.get(locale);
  if (cached) return cached;
  const strings = Object.freeze(mergeLocaleStrings(locale, KIT_MESSAGES, theme.messages ?? {}));
  byLocale.set(locale, strings);
  return strings;
}
