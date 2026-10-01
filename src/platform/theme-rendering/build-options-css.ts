import type { ResolvedThemeOptions, ThemeOptionField } from "@/contexts/themes/contracts/v8";

export type OptionsCssAndAttrs = { css: string; attributes: Record<string, string> };

// select/boolean → atributo `data-opt-<key>` no <html>; range/color → `--opt-<key>` validada no CSS
// de runtime (spec §2.3). `scope` troca o seletor (galeria, W10). Dono: W2 — na Fase F nenhum
// tema declara opções, então não há CSS nem atributo.
export function buildOptionsCssAndAttrs(
  fields: readonly ThemeOptionField[],
  options: ResolvedThemeOptions,
  context: { themeKey: string; scope?: string },
): OptionsCssAndAttrs {
  void fields;
  void options;
  void context;
  return { css: "", attributes: {} };
}
