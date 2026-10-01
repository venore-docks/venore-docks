import {
  DEFAULT_PAGE_LAYOUT,
  type ResolvedPageLayout,
  type ResolvedThemeDefinition,
  type ThemeSectionOverride,
} from "@/contexts/themes/contracts/v8";

// Layout da página (largura, rail, barra contextual, variante de template) — precedência entry →
// seção → padrão do tema (spec §7.15), reaproveitando getCachedPublishedEntryBySlug. Dono: W5 —
// na Fase F, o padrão (largura contida, rail visível, barra contextual ao lado) = o de hoje.
export async function resolvePageLayout(
  pathname: string | null,
  theme: ResolvedThemeDefinition,
  section: ThemeSectionOverride | null,
): Promise<ResolvedPageLayout> {
  void pathname;
  void theme;
  void section;
  return DEFAULT_PAGE_LAYOUT;
}
