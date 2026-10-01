import type { ThemeBlockRenderers } from "@/contexts/themes/contracts/v8";

// Renderers de bloco do tema por (bloco, variante), memoizados por theme key por processo e
// separados do cachedRenderers do core (spec §7.15). Dono: W5 — na Fase F nenhum tema tem
// renderers próprios e o BlockRenderer não consulta isto.
export async function loadThemeBlockRenderers(themeKey?: string): Promise<ThemeBlockRenderers> {
  void themeKey;
  return {};
}
