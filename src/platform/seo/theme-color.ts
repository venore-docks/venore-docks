import type { ResolvedThemeDefinition, ThemePaletteChoice } from "@/contexts/themes/contracts/v8";
import { isValidHexColor, oklchToHex, parseOklchNumeric } from "@/platform/theme-engine/oklch-color";
import { paletteFromChoice } from "@/platform/theme-rendering/resolve-active-color-palette";
import { THEME_TOKEN_VALUES, type ThemeTokenValues } from "@/themes/theme-tokens.generated";

// Cor de chrome escura, combinando com o wordmark branco da marca — a de antes da v8, e a do
// venore-slime (que não declara seo.themeColor: o header dele é a identidade escura do app).
export const CHROME_DARK = "#171717";

export type ThemeChromeColors = { light: string; dark: string };

// "#abc" / "#aabbcc" / "oklch(L C H)" → "#rrggbb"; qualquer outra coisa (var(), color-mix()) não
// dá pra resolver sem um navegador → null.
export function colorToHex(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (isValidHexColor(trimmed)) return trimmed.toLowerCase();
  const oklch = parseOklchNumeric(trimmed);
  return oklch ? oklchToHex(oklch.l, oklch.c, oklch.h) : null;
}

type Mode = "light" | "dark";

function fromTokenTable(values: ThemeTokenValues | undefined, mode: Mode): string | null {
  const table = values?.[mode];
  if (!table) return null;
  return (
    colorToHex(table["--header-bg"] ?? table["header-bg"]) ?? colorToHex(table["--background"] ?? table["background"])
  );
}

function fromPalette(theme: Pick<ResolvedThemeDefinition, "colorPalettes">, choice: ThemePaletteChoice | undefined, mode: Mode) {
  const palette = paletteFromChoice(theme.colorPalettes, choice);
  if (!palette) return null;
  const tokens = palette[mode] as Record<string, string | undefined>;
  return colorToHex(tokens["header-bg"]) ?? colorToHex(tokens.background);
}

// themeColor do navegador/PWA (spec §7.7). Ordem: seo.themeColor explícito do tema → sob
// "from-tokens", o --header-bg resolvido (paleta ativa → tokens do tema) e só depois --background
// (errata §15: header primeiro) → sem declaração, CHROME_DARK (o de hoje).
export function resolveThemeChromeColors(
  theme: Pick<ResolvedThemeDefinition, "key" | "seo" | "colorPalettes">,
  choice?: ThemePaletteChoice,
  tokenValues: Record<string, ThemeTokenValues> = THEME_TOKEN_VALUES,
): ThemeChromeColors {
  const declared = theme.seo.themeColor;
  if (declared && typeof declared === "object") {
    return { light: colorToHex(declared.light) ?? CHROME_DARK, dark: colorToHex(declared.dark) ?? CHROME_DARK };
  }
  if (declared === "from-tokens") {
    const resolve = (mode: Mode) =>
      fromPalette(theme, choice, mode) ?? fromTokenTable(tokenValues[theme.key], mode) ?? CHROME_DARK;
    return { light: resolve("light"), dark: resolve("dark") };
  }
  return { light: CHROME_DARK, dark: CHROME_DARK };
}
