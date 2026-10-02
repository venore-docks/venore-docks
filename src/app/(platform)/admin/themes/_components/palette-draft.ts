import type { ThemeConfigDocument, ThemePaletteChoice } from "@/contexts/themes/contracts/v8";
import { emptyThemeConfigEntry } from "@/contexts/themes/contracts/v8";
import { oklchToHex, parseCssColor } from "@/platform/theme-engine/oklch-color";

// Modelo puro do painel de paleta do rascunho (customize/_panels/palette-panel.tsx, spec v8 §9).
// A paleta é POR TEMA (`byTheme[themeKey].palette`): trocar de tema no rascunho não carrega a
// escolha de um tema pro outro.

export type PaletteMode = ThemePaletteChoice["mode"];
type CustomChoice = Extract<ThemePaletteChoice, { mode: "custom" }>;

// Tokens editáveis à mão no modo "Personalizada" — o essencial de superfície/texto/marca. O resto
// continua vindo do theme.css (override parcial).
export const PALETTE_PANEL_TOKENS = [
  { token: "background", label: "Fundo" },
  { token: "foreground", label: "Texto" },
  { token: "card", label: "Card" },
  { token: "muted-foreground", label: "Texto secundário" },
  { token: "primary", label: "Primária" },
  { token: "primary-foreground", label: "Texto sobre primária" },
  { token: "accent", label: "Destaque" },
  { token: "border", label: "Borda" },
] as const;

export function currentPaletteChoice(draft: ThemeConfigDocument, themeKey: string): ThemePaletteChoice {
  return draft.byTheme[themeKey]?.palette ?? { mode: "default" };
}

export function withPaletteChoice(
  draft: ThemeConfigDocument,
  themeKey: string,
  palette: ThemePaletteChoice,
): Pick<ThemeConfigDocument, "byTheme"> {
  const entry = draft.byTheme[themeKey] ?? emptyThemeConfigEntry();
  return { byTheme: { ...draft.byTheme, [themeKey]: { ...entry, palette } } };
}

// Ponto de partida do modo "Personalizada": a partir de uma semente, os tokens gerados (o admin
// ajusta em cima); de qualquer outra coisa, vazio (= theme.css).
export function toCustomChoice(choice: ThemePaletteChoice): CustomChoice {
  if (choice.mode === "custom") return choice;
  if (choice.mode === "seed") return { mode: "custom", light: { ...choice.generated.light }, dark: { ...choice.generated.dark } };
  return { mode: "custom", light: {}, dark: {} };
}

export function setCustomToken(choice: ThemePaletteChoice, mode: "light" | "dark", token: string, value: string | null): CustomChoice {
  const custom = toCustomChoice(choice);
  const tokens = { ...custom[mode] };
  if (value === null) delete tokens[token];
  else tokens[token] = value;
  return { ...custom, [mode]: tokens };
}

// <input type="color"> só entende #rrggbb: converte oklch (presets/import) pra exibir.
export function toPickerHex(value: string | undefined): string | null {
  if (!value) return null;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const parsed = parseCssColor(value);
  return parsed ? oklchToHex(parsed.l, parsed.c, parsed.h) : null;
}
