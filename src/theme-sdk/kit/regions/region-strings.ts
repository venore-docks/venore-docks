import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../i18n/t";

// Textos novos das regiões do kit introduzidos pelo W3 (rótulos de <nav>, modos de navegação
// mobile). O catálogo `kit/i18n/**` é do W8; enquanto ele não absorve estas chaves (pedido em
// /home/user/v8/requests/w3.md), esta tabela é o fallback pt-BR — a ordem continua sendo:
// strings resolvidas do tema/locale → esta tabela → `t()` (catálogo pt-BR do kit → a chave).
export const KIT_REGION_STRINGS_PT_BR = {
  "header.navLabel": "Menu do cabeçalho",
  "rail.navLabel": "Navegação principal",
  "rail.adminNavLabel": "Navegação do admin",
  "mobileNav.label": "Navegação",
  "mobileNav.more": "Mais",
  "mobileNav.moreLabel": "Mais opções de navegação",
  "contextual.mobileSummary": "Nesta seção",
} as const satisfies Record<string, string>;

export function regionText(strings: ThemeStrings | undefined, key: string): string {
  return strings?.[key] ?? (KIT_REGION_STRINGS_PT_BR as Record<string, string>)[key] ?? t(strings, key);
}
