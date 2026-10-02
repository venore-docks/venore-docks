import { getSetting, setSetting } from "@/contexts/settings";
import type { ColorPalette, PaletteColorToken, PaletteColorTokens } from "@/contexts/themes";
import type { OperationResult } from "@/shared/types";
import { CUSTOM_COLOR_PALETTE_ID } from "./custom-color-palette-id";
import { REGION_TOKEN_ROLES, type ThemePaletteRules } from "@/contexts/themes/contracts/v8";
import {
  checkRegionContrast,
  contrastRatio,
  describeRegionContrastProblem,
  MIN_CUSTOM_PALETTE_CONTRAST,
  REGION_CONTRAST_PAIRS,
} from "./contrast";
import { regionTokenName, THEME_TOKEN_REGIONS } from "./token-values";
import { isValidHexColor } from "./oklch-color";

export { CUSTOM_COLOR_PALETTE_ID };

// Uma paleta personalizada POR TEMA — a chave carrega o themeKey. Antes era uma chave global
// (`theme.customColorPalette`), então trocar de tema mantinha as cores personalizadas por cima
// de uma base diferente. Agora a paleta viaja com o tema, igual aos presets de catálogo.
const SETTING_KEY_PREFIX = "theme.customColorPalette";
const settingKeyFor = (themeKey: string) => `${SETTING_KEY_PREFIX}.${themeKey}`;

// Espelha o union inteiro de PaletteColorToken (contracts/types.ts) — cada um mapeia 1:1 pra uma
// var shadcn/estrutural de theme.css (AGENTS.md §3). Ampliado de 9 pra 25 tokens (pedido de
// sessão: "a paleta muda só alguns elementos, sidebar nunca muda") — card/popover/muted/border/
// input (vocabulário mínimo, VENORE-DOCKS.md §7) e a família sidebar/header/app-background, que
// antes ficava fora do alcance da paleta mesmo sendo var(...) legítimo em todo theme.css do
// workspace (ver full-palette-generator.ts pro detalhe).
export const CUSTOM_COLOR_TOKENS: readonly PaletteColorToken[] = [
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "background",
  "foreground",
  "accent",
  "accent-foreground",
  "ring",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "border",
  "input",
  "sidebar-bg-start",
  "sidebar-bg-end",
  "sidebar-bg-admin-start",
  "sidebar-bg-admin-end",
  "header-bg",
  "app-bg-start",
  "app-bg-mid",
  "app-bg-end",
];

// Os 25 tokens tier-2 + tier-3 de região (CUSTOM_REGION_TOKENS), todos #rrggbb.
export type CustomColorPaletteInput = { light: CustomPaletteTokens; dark: CustomPaletteTokens };
export type CustomPaletteTokens = PaletteColorTokens | Readonly<Record<string, string>>;

type StoredCustomColorPalette = { light: PaletteColorTokens; dark: PaletteColorTokens };

// Tier-3 (spec v8 §2.4/§3): o gerador com regras de região (palette/generate-theme-palette.ts)
// devolve `region-<região>-<papel>` junto dos 25 tokens — a paleta personalizada guarda os dois.
export const CUSTOM_REGION_TOKENS: readonly string[] = THEME_TOKEN_REGIONS.flatMap((region) =>
  REGION_TOKEN_ROLES.map((role) => regionTokenName(region, role)),
);
const ACCEPTED_TOKENS = new Set<string>([...CUSTOM_COLOR_TOKENS, ...CUSTOM_REGION_TOKENS]);

// <input type="color"> do client só produz #rrggbb, mas isValidHexColor (oklch-color.ts) é a
// defesa de verdade contra payload malformado batendo direto no FormData (ver aviso em
// app/layout.tsx sobre dangerouslySetInnerHTML: cor arbitrária de admin exige validação antes de
// virar CSS).
function hasOnlyValidHexTokens(tokens: Readonly<Record<string, string | undefined>>): boolean {
  return Object.entries(tokens).every(
    ([token, value]) => ACCEPTED_TOKENS.has(token) && typeof value === "string" && isValidHexColor(value),
  );
}

// Pares texto/superfície fora das regiões — card e popover são as superfícies mais comuns na
// prática (todo painel usa --card). Os pares por região (fg/bg e muted-fg/bg em header, rail,
// contextual, content e footer) vêm de checkRegionContrast (contrast.ts).
const SURFACE_PAIRS: { fg: string; bg: string; label: string }[] = [
  { fg: "card-foreground", bg: "card", label: "texto/card" },
  { fg: "popover-foreground", bg: "popover", label: "texto/popover" },
];

export type CustomPaletteContrastProblem = { regions: string[]; message: string };

// Só checa um par quando os DOIS tokens existem naquele modo — um modo que só mexe em `primary`
// não é barrado (a paleta personalizada é override parcial; o resto vem do theme.css, já testado
// em theme-contrast.test.ts). Bloqueia só pares de TEXTO (4.5 ou o minContrast da região): os
// não-textuais (ring/accent, 3:1) são reportados pelo gerador e pela galeria, não barram o save —
// sementes claras do "1 cor de marca" geram accent/ring abaixo de 3:1 desde sempre.
export function findCustomPaletteContrastProblem(
  input: { light: Readonly<Record<string, string | undefined>>; dark: Readonly<Record<string, string | undefined>> },
  rules?: ThemePaletteRules,
): CustomPaletteContrastProblem | null {
  for (const mode of ["light", "dark"] as const) {
    const tokens = Object.fromEntries(
      Object.entries(input[mode]).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
    const modeLabel = mode === "light" ? "modo claro" : "modo escuro";
    for (const pair of SURFACE_PAIRS) {
      const fg = tokens[pair.fg];
      const bg = tokens[pair.bg];
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < MIN_CUSTOM_PALETTE_CONTRAST) {
        return {
          regions: [],
          message: `Contraste ${pair.label} no ${modeLabel} é ${ratio.toFixed(1)}:1 — mínimo ${MIN_CUSTOM_PALETTE_CONTRAST}:1 pra legibilidade.`,
        };
      }
    }
  }

  const problems = checkRegionContrast(
    { light: definedOnly(input.light), dark: definedOnly(input.dark) },
    { regions: rules?.regions, surfaces: "tokens" },
  ).filter((problem) => REGION_CONTRAST_PAIRS.find((pair) => pair.pair === problem.pair)?.kind === "text");
  if (problems.length === 0) return null;
  const regions = [...new Set(problems.map((problem) => problem.region))];
  return {
    regions,
    message: `${describeRegionContrastProblem(problems[0])} Regiões com contraste insuficiente: ${regions.join(", ")}.`,
  };
}

// Pares por região só com os tokens que a paleta declara: sem fundo OU sem texto, o par é pulado
// (checkRegionContrast pula token que não resolve).
function definedOnly(tokens: Readonly<Record<string, string | undefined>>): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

// Código do spec §7.14 (antes `theme-engine.custom_color_palette.low_contrast`).
export const PALETTE_LOW_CONTRAST = "theme-engine.palette.low_contrast";

export async function setCustomColorPalette(
  themeKey: string,
  input: CustomColorPaletteInput,
  rules?: ThemePaletteRules,
): Promise<OperationResult<{ id: string }>> {
  if (!hasOnlyValidHexTokens(input.light) || !hasOnlyValidHexTokens(input.dark)) {
    return {
      success: false,
      error: {
        code: "theme-engine.custom_color_palette.invalid_value",
        message: "Cada cor precisa ser um hexadecimal válido (#rrggbb).",
      },
    };
  }

  const contrastError = findCustomPaletteContrastProblem(input, rules);
  if (contrastError) {
    return { success: false, error: { code: PALETTE_LOW_CONTRAST, message: contrastError.message } };
  }

  const stored: StoredCustomColorPalette = { light: input.light, dark: input.dark };
  const result = await setSetting({ key: settingKeyFor(themeKey), value: stored });
  if (!result.success) return result;

  return { success: true, data: { id: CUSTOM_COLOR_PALETTE_ID } };
}

export async function getCustomColorPalette(themeKey: string): Promise<ColorPalette> {
  // skipCache: a paleta personalizada vira CSS de override no root layout de toda rota — mesma
  // defasagem multi-instância que afeta theme.active/theme.activePaletteId (ver GetSettingQuery).
  const result = await getSetting({ key: settingKeyFor(themeKey), skipCache: true });
  const stored = result.success && result.data ? (result.data.value as StoredCustomColorPalette) : null;

  return {
    id: CUSTOM_COLOR_PALETTE_ID,
    name: "Personalizada",
    light: stored?.light ?? {},
    dark: stored?.dark ?? {},
  };
}
