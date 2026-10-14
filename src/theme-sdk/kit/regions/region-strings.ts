import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { t } from "../i18n/t";

// Textos das regiões do kit introduzidos pelo W3 (rótulos de <nav>, modos de navegação mobile).
// As chaves agora moram nos catálogos (`kit/i18n/messages/*`, W8); `regionText` ficou como alias
// de `t()` para não mexer nas regiões: strings resolvidas do tema/locale → pt-BR do kit → chave.
export function regionText(strings: ThemeStrings | undefined, key: string): string {
  return t(strings, key);
}
