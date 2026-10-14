import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { formatDate } from "@/shared/format-date";
import type { KitMessageKey } from "../i18n/messages/pt-BR";
import { t } from "../i18n/t";

// Textos dos templates/estados do kit (W4). As chaves agora moram nos catálogos
// (`kit/i18n/messages/*`, W8); `templateText` ficou como alias tipado de `t()`.
export type KitTemplateStringKey = Extract<
  KitMessageKey,
  `login.${string}` | `home.${string}` | `category.${string}` | `maintenance.${string}`
>;

export function templateText(strings: ThemeStrings | undefined, key: KitTemplateStringKey): string {
  return t(strings, key);
}

// Data de publicação no formato longo do locale ("15 de março de 2026" em pt-BR) — o template
// recebe ISO (ThemeEntryView.publishedAt) e decide como mostrar. Mesmo Intl que a página usava.
export function formatEntryDate(iso: string | null, locale: string): string | null {
  return formatDate(iso, locale, "long");
}
