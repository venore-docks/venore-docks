import type { OutletRenderContext, ResolvedThemeDefinition, ThemeOutletNodes } from "@/contexts/themes/contracts/v8";

// Contribuições de plugin para os outlets do tema (spec §7.4: ativos, área, match, ordem,
// timeout de 1500 ms, Suspense + boundary). Dono: W7 — na Fase F nenhum plugin contribui outlet.
export async function resolveThemeOutlets(context: OutletRenderContext, theme: ResolvedThemeDefinition): Promise<ThemeOutletNodes> {
  void context;
  void theme;
  return {};
}
