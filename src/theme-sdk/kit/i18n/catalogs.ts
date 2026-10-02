import type { ThemeMessages, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { KIT_MESSAGES_AR } from "./messages/ar";
import { KIT_MESSAGES_EN } from "./messages/en";
import { KIT_MESSAGES_ES } from "./messages/es";
import { KIT_MESSAGES_PT_BR } from "./messages/pt-BR";

// Catálogos do kit por locale (spec §7.11). pt-BR é a base (texto de hoje) e o último degrau
// antes da própria chave.
export const KIT_BASE_LOCALE = "pt-BR";
export const KIT_MESSAGES: ThemeMessages = {
  "pt-BR": KIT_MESSAGES_PT_BR,
  en: KIT_MESSAGES_EN,
  es: KIT_MESSAGES_ES,
  ar: KIT_MESSAGES_AR,
};

// Degraus de busca de um locale, do mais específico ao base: "pt-PT" → ["pt-PT", "pt", "pt-BR"];
// "ar" → ["ar", "pt-BR"]. Sem duplicatas.
export function localeFallbackChain(locale: string): string[] {
  const chain: string[] = [];
  const push = (value: string) => {
    if (value && !chain.some((item) => item.toLowerCase() === value.toLowerCase())) chain.push(value);
  };
  push(locale);
  push(locale.split("-")[0] ?? "");
  push(KIT_BASE_LOCALE);
  return chain;
}

// Catálogo de um locale por nome, sem diferenciar maiúsculas (o setting é canônico — "pt-BR" —,
// mas o pacote de tema pode declarar "pt-br").
function catalogFor(messages: ThemeMessages, locale: string): Readonly<Record<string, string>> | undefined {
  if (messages[locale]) return messages[locale];
  const lower = locale.toLowerCase();
  const match = Object.keys(messages).find((key) => key.toLowerCase() === lower);
  return match ? messages[match] : undefined;
}

// Strings do locale: para cada chave, locale → idioma → pt-BR; em cada degrau a mensagem do tema
// vence a do kit. A chave ausente em tudo fica de fora — `t()` devolve a própria chave.
export function mergeLocaleStrings(locale: string, kit: ThemeMessages, theme: ThemeMessages): ThemeStrings {
  const merged: Record<string, string> = {};
  for (const step of localeFallbackChain(locale).reverse()) {
    Object.assign(merged, catalogFor(kit, step), onlyStrings(catalogFor(theme, step)));
  }
  return merged;
}

// Mensagem de tema vem de pacote (JSON): só strings entram.
function onlyStrings(catalog: Readonly<Record<string, unknown>> | undefined): Record<string, string> {
  if (!catalog) return {};
  return Object.fromEntries(Object.entries(catalog).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
