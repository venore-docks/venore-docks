import { normalizePathPrefix } from "@/shared/normalize-path-prefix";
import type { OperationResult } from "@/shared/types";
import type { ThemeSectionOverride } from "../../../contracts/v8/config-document";

// Primeiros segmentos que nenhuma seção de tema pode reivindicar (spec §2.13/§7.3): o admin nunca
// é tematizado por seção, /ext e /api não passam pela shell, /login é do grupo (auth). `_next` é
// do próprio Next. A raiz "/" também é proibida — "o site inteiro" é o tema do documento, não
// uma seção.
export const RESERVED_SECTION_SEGMENTS: readonly string[] = ["admin", "ext", "api", "login", "_next"];

export function isReservedSectionPrefix(prefix: string): boolean {
  const normalized = normalizePathPrefix(prefix);
  if (normalized === "/") return true;
  const firstSegment = normalized.split("/")[1] ?? "";
  return RESERVED_SECTION_SEGMENTS.includes(firstSegment);
}

// Normaliza o prefixo de cada seção (mesma forma que o casamento usa) e recusa prefixo
// reservado, vazio ou repetido. Regra de negócio do documento — vale pra salvar e importar.
export function normalizeSectionOverrides(sections: readonly ThemeSectionOverride[]): OperationResult<ThemeSectionOverride[]> {
  const seenPrefixes = new Set<string>();
  const seenIds = new Set<string>();
  const normalized: ThemeSectionOverride[] = [];
  for (const section of sections) {
    const pathPrefix = normalizePathPrefix(section.pathPrefix);
    if (isReservedSectionPrefix(pathPrefix)) {
      return {
        success: false,
        error: {
          code: "themes.config.section_reserved_prefix",
          message: `A seção "${section.label}" usa o caminho reservado "${pathPrefix}" (não pode ser "/", /admin, /ext, /api nem /login).`,
        },
      };
    }
    if (seenPrefixes.has(pathPrefix)) {
      return {
        success: false,
        error: { code: "themes.config.section_duplicate_prefix", message: `Duas seções usam o mesmo caminho "${pathPrefix}".` },
      };
    }
    if (seenIds.has(section.id)) {
      return { success: false, error: { code: "themes.config.section_duplicate_id", message: `Id de seção repetido: "${section.id}".` } };
    }
    seenPrefixes.add(pathPrefix);
    seenIds.add(section.id);
    normalized.push({ ...section, pathPrefix });
  }
  return { success: true, data: normalized };
}
