import { getSetting, setSetting } from "@/contexts/settings";
import type { ColorPalette, PaletteColorToken, PaletteColorTokens } from "@/contexts/themes";
import type { OperationResult } from "@/shared/types";
import { CUSTOM_COLOR_PALETTE_ID } from "./custom-color-palette-id";
import { contrastRatio, MIN_CUSTOM_PALETTE_CONTRAST } from "./contrast";
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

export type CustomColorPaletteInput = { light: PaletteColorTokens; dark: PaletteColorTokens };

type StoredCustomColorPalette = { light: PaletteColorTokens; dark: PaletteColorTokens };

// <input type="color"> do client só produz #rrggbb, mas isValidHexColor (oklch-color.ts) é a
// defesa de verdade contra payload malformado batendo direto no FormData (ver aviso em
// app/layout.tsx sobre dangerouslySetInnerHTML: cor arbitrária de admin exige validação antes de
// virar CSS).
function hasOnlyValidHexTokens(tokens: PaletteColorTokens): boolean {
  return Object.entries(tokens).every(
    ([token, value]) =>
      CUSTOM_COLOR_TOKENS.includes(token as PaletteColorToken) && typeof value === "string" && isValidHexColor(value),
  );
}

// Pares texto/fundo que precisam de contraste mínimo — foreground/background é o mais óbvio, mas
// card e popover são as superfícies mais comuns na prática (todo painel usa --card).
const CONTRAST_PAIRS: { fg: PaletteColorToken; bg: PaletteColorToken; label: string }[] = [
  { fg: "foreground", bg: "background", label: "texto/fundo" },
  { fg: "card-foreground", bg: "card", label: "texto/card" },
  { fg: "popover-foreground", bg: "popover", label: "texto/popover" },
];

// Só checa um par quando os DOIS tokens existem naquele modo — um modo que só mexe em `primary`
// não é barrado. Retorna a mensagem de erro do primeiro par com problema, ou null se está tudo ok.
function contrastProblem(tokens: PaletteColorTokens, modeLabel: string): string | null {
  for (const pair of CONTRAST_PAIRS) {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio < MIN_CUSTOM_PALETTE_CONTRAST) {
      return `Contraste ${pair.label} no ${modeLabel} é ${ratio.toFixed(1)}:1 — mínimo ${MIN_CUSTOM_PALETTE_CONTRAST}:1 pra legibilidade.`;
    }
  }
  return null;
}

export async function setCustomColorPalette(
  themeKey: string,
  input: CustomColorPaletteInput,
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

  const contrastError = contrastProblem(input.light, "modo claro") ?? contrastProblem(input.dark, "modo escuro");
  if (contrastError) {
    return {
      success: false,
      error: { code: "theme-engine.custom_color_palette.low_contrast", message: contrastError },
    };
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
