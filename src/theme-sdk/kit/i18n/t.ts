import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { KIT_MESSAGES_PT_BR } from "./messages/pt-BR";

// `t` puro (spec §0.7 / §7.11): lê de um objeto de strings já resolvido pro locale; sem a chave,
// cai no pt-BR do kit e, por último, na própria chave. `{nome}` é interpolado com `vars`.
export const KIT_STRINGS_PT_BR: ThemeStrings = KIT_MESSAGES_PT_BR;

export function t(strings: ThemeStrings | undefined, key: string, vars?: Record<string, string | number>): string {
  const raw = strings?.[key] ?? (KIT_MESSAGES_PT_BR as Record<string, string>)[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
