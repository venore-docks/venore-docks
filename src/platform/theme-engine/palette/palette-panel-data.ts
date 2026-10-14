import type { ColorPalette } from "@/contexts/themes";
import { THEME_TOKEN_REGIONS, type RegionTone, type ResolvedThemeDefinition, type ThemeTokenRegion } from "@/contexts/themes/contracts/v8";

// Dados do painel de paleta (presets do catálogo, sementes, tons por região, tokens travados),
// derivados só da definição do tema — sem gerador nem tokens de outros temas, então roda também
// no client (painel do /admin/themes/customize, que recebe colorPalettes/palette pela view).
type PalettePanelTheme = Pick<ResolvedThemeDefinition, "key" | "colorPalettes" | "palette">;

export type PalettePresetView = { id: string; name: string; swatches: string[] };
export type PaletteRegionToneView = { region: ThemeTokenRegion; tone: RegionTone; minContrast: number | null };
export type PalettePanelData = {
  themeKey: string;
  presets: PalettePresetView[]; // catálogo do tema (colorPalettes) → escolha "preset"
  seedPresets: { id: string; name: string; seed: string }[]; // regras do tema (palette.presets) → escolha "seed"
  allowCustom: boolean;
  regionTones: PaletteRegionToneView[]; // só as regiões com tom ≠ inherit
  lockedTokens: string[];
};

const SWATCH_TOKENS = ["primary", "accent", "sidebar-bg-start", "background"] as const;

function swatches(palette: ColorPalette): string[] {
  return SWATCH_TOKENS.map((token) => palette.light[token]).filter((value): value is string => Boolean(value));
}

export function buildPalettePanelData(theme: PalettePanelTheme): PalettePanelData {
  const rules = theme.palette ?? {};
  return {
    themeKey: theme.key,
    presets: theme.colorPalettes.map((palette) => ({ id: palette.id, name: palette.name, swatches: swatches(palette) })),
    seedPresets: (rules.presets ?? []).map((preset) => ({ ...preset })),
    allowCustom: rules.allowCustom !== false,
    regionTones: THEME_TOKEN_REGIONS.flatMap((region) => {
      const rule = rules.regions?.[region];
      if (!rule || rule.tone === "inherit") return [];
      return [{ region, tone: rule.tone, minContrast: rule.minContrast ?? null }];
    }),
    lockedTokens: [...(rules.lockedTokens ?? [])],
  };
}
