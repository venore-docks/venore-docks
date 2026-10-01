import type { FontId, FontRole, ResolvedThemeDefinition, ResolvedThemeOptions } from "@/contexts/themes/contracts/v8";
import { DEFAULT_FONT_CLASS_NAMES } from "@/platform/theme-fonts/registry";

// Fontes do documento (spec §7.6): manifesto ← opções do tipo font ← config salva; admin sempre
// Geist. Devolve as classes `.variable` a aplicar no <html> e o CSS `--theme-font-*`. Dono: W8 —
// na Fase F, só Geist/Geist Mono (o que o root layout já carregava) e nenhum CSS.
export function resolveDocumentFonts(
  theme: ResolvedThemeDefinition,
  stored: Partial<Record<FontRole, FontId>> | undefined,
  options: ResolvedThemeOptions,
  area: "public" | "admin",
): { classNames: string; css: string } {
  void theme;
  void stored;
  void options;
  void area;
  return { classNames: DEFAULT_FONT_CLASS_NAMES, css: "" };
}
