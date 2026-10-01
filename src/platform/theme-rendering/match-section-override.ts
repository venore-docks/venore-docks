import type { ThemeSectionOverride } from "@/contexts/themes/contracts/v8";

// Seção de site com tema/layout próprios (spec §7.3: prefixo mais longo em fronteira de segmento,
// nunca em /admin). Dono: W6 — na Fase F nenhuma seção casa.
export function matchSectionOverride(
  sections: readonly ThemeSectionOverride[],
  pathname: string | null,
  area: "public" | "admin",
): ThemeSectionOverride | null {
  void sections;
  void pathname;
  void area;
  return null;
}
