import type { ColorPalette, PaletteColorTokens } from "@/contexts/themes";
import type {
  RegionTone,
  ResolvedThemeDefinition,
  ThemePaletteChoice,
  ThemeTokenRegion,
} from "@/contexts/themes/contracts/v8";
import { THEME_COLOR_VALUE_PATTERN } from "@/contexts/themes/contracts/v8";
import type { OperationResult } from "@/shared/types";
import { checkRegionContrast, describeRegionContrastProblem, type RegionContrastProblem } from "../contrast";
import { effectiveTokens, getThemeTokenValues, THEME_TOKEN_REGIONS } from "../token-values";
import { generateThemePalette } from "./generate-theme-palette";

// Composição pura do admin de paleta (spec v8 §9 — seção de /admin/themes e painel de
// /admin/themes/customize). As actions de admin/themes/actions.ts só autorizam e chamam isto; o
// painel (client) recebe dado serializável, nunca o gerador (que puxa os tokens de todo tema).

type PaletteTheme = Pick<ResolvedThemeDefinition, "key" | "colorPalettes" | "palette">;

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

export type PaletteContrastView = { region: ThemeTokenRegion; mode: "light" | "dark"; message: string };

const SWATCH_TOKENS = ["primary", "accent", "sidebar-bg-start", "background"] as const;

function swatches(palette: ColorPalette): string[] {
  return SWATCH_TOKENS.map((token) => palette.light[token]).filter((value): value is string => Boolean(value));
}

export function buildPalettePanelData(theme: PaletteTheme): PalettePanelData {
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

export function toContrastViews(problems: readonly RegionContrastProblem[]): PaletteContrastView[] {
  return problems.map((problem) => ({ region: problem.region, mode: problem.mode, message: describeRegionContrastProblem(problem) }));
}

// "Cor de marca" no rascunho: semente → escolha `seed` com os tokens já gerados pelas regras do
// tema (tons por região inclusos). O documento guarda o resultado, então o render nunca roda o
// gerador.
export function generateSeedChoice(
  theme: PaletteTheme,
  seed: string,
): OperationResult<{ choice: Extract<ThemePaletteChoice, { mode: "seed" }>; problems: PaletteContrastView[] }> {
  if (!THEME_COLOR_VALUE_PATTERN.test(seed)) {
    return {
      success: false,
      error: { code: "theme-engine.palette.invalid_seed", message: "A cor de marca precisa ser hex (#rrggbb) ou oklch(L C H)." },
    };
  }
  const result = generateThemePalette({ seed, rules: theme.palette, base: getThemeTokenValues(theme.key) });
  return {
    success: true,
    data: { choice: { mode: "seed", seed, generated: { light: result.light, dark: result.dark } }, problems: paletteProblems(theme, result) },
  };
}

// Tokens efetivos de uma escolha (sem o gerador: a escolha já carrega os tokens).
function choiceTokens(theme: PaletteTheme, choice: ThemePaletteChoice): { light: PaletteColorTokens; dark: PaletteColorTokens } | null {
  if (choice.mode === "default") return null;
  if (choice.mode === "preset") return theme.colorPalettes.find((palette) => palette.id === choice.presetId) ?? null;
  if (choice.mode === "seed") return choice.generated;
  return { light: choice.light, dark: choice.dark };
}

// Contraste por região que a PALETTE introduz sobre o theme.css do tema: problema que o tema já
// tem sem paleta nenhuma (dívida do pacote, ver src/themes/a11y-baseline.json) não é culpa da
// escolha do admin e não aparece aqui.
function paletteProblems(theme: PaletteTheme, tokens: { light?: PaletteColorTokens; dark?: PaletteColorTokens } | null): PaletteContrastView[] {
  const base = getThemeTokenValues(theme.key);
  const options = { regions: theme.palette?.regions };
  const key = (problem: RegionContrastProblem) => `${problem.region}/${problem.mode}/${problem.pair}`;
  const inherited = new Set(checkRegionContrast(effectiveTokens(base), options).map(key));
  const problems = checkRegionContrast(effectiveTokens(base, tokens), options).filter((problem) => !inherited.has(key(problem)));
  return toContrastViews(problems);
}

export function checkPaletteChoiceContrast(theme: PaletteTheme, choice: ThemePaletteChoice): PaletteContrastView[] {
  return paletteProblems(theme, choiceTokens(theme, choice));
}

// Mesma checagem pra paleta legada ativa (seção do catálogo, fluxo theme.activePaletteId).
export function checkActivePaletteContrast(theme: PaletteTheme, palette: ColorPalette | null): PaletteContrastView[] {
  return paletteProblems(theme, palette);
}
