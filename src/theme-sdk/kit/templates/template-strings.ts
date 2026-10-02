import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../i18n/t";

// Textos dos templates/estados do kit que ainda não estão nos catálogos (kit/i18n/messages/*, dono
// W8) — mesmo padrão de regions/region-strings.ts do W3. Texto IDÊNTICO ao que as páginas tinham
// fixo antes da v8. Ordem de busca: strings do tema/locale → esta tabela → t() (catálogo do kit).
// Quando o W8 levar estas chaves para os catálogos, a tabela vira redundante e pode sair.
export const KIT_TEMPLATE_STRINGS_PT_BR = {
  "login.title": "Entrar",
  "login.subtitle": "Acesse com uma das opções abaixo.",
  "home.empty.title": "Nenhum conteúdo publicado ainda",
  "home.empty.message": "O conteúdo aparece aqui assim que for publicado.",
  "category.readMore": "Ler mais",
  "category.newer": "Mais recentes",
  "category.older": "Mais antigos",
  "category.paginationLabel": "Paginação",
  "maintenance.title": "Em manutenção",
  "maintenance.message": "O site volta em instantes.",
} as const satisfies Record<string, string>;
export type KitTemplateStringKey = keyof typeof KIT_TEMPLATE_STRINGS_PT_BR;

export function templateText(strings: ThemeStrings | undefined, key: KitTemplateStringKey): string {
  return strings?.[key] ?? KIT_TEMPLATE_STRINGS_PT_BR[key] ?? t(strings, key);
}

// Data de publicação no formato longo do locale ("15 de março de 2026" em pt-BR) — o template
// recebe ISO (ThemeEntryView.publishedAt) e decide como mostrar. Mesmo Intl que a página usava.
export function formatEntryDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  }
}
