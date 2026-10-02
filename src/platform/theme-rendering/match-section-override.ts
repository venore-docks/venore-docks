import { isReservedSectionPrefix } from "@/contexts/themes";
import type { ThemeSectionOverride } from "@/contexts/themes/contracts/v8";
import { isPathUnderPrefix, normalizePathPrefix } from "@/shared/normalize-path-prefix";

// Seção de site com tema/layout próprios (spec §7.3): casa o prefixo MAIS LONGO em fronteira de
// segmento (`/rh` casa `/rh` e `/rh/x`, nunca `/rhx`), com a mesma normalização da escrita
// (normalizePathPrefix: decode, NFC, minúsculas, sem barra final). Nunca em /admin (área decidida
// só pelo caminho). Prefixo reservado ("/", /admin, /ext, /api, /login) é ignorado mesmo que
// tenha chegado ao documento por fora da validação de escrita.
export function matchSectionOverride(
  sections: readonly ThemeSectionOverride[],
  pathname: string | null,
  area: "public" | "admin",
): ThemeSectionOverride | null {
  if (area === "admin" || !pathname || sections.length === 0) return null;
  const path = normalizePathPrefix(pathname);
  if (isReservedSectionPrefix(path) && path !== "/") return null;

  let best: { section: ThemeSectionOverride; length: number } | null = null;
  for (const section of sections) {
    const prefix = normalizePathPrefix(section.pathPrefix);
    if (isReservedSectionPrefix(prefix)) continue;
    if (!isPathUnderPrefix(path, prefix)) continue;
    if (!best || prefix.length > best.length) best = { section, length: prefix.length };
  }
  return best?.section ?? null;
}
