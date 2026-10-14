import type { PaletteColorTokens } from "@/contexts/themes";
import type { Oklch } from "./oklch-color";
import { generateThemePalette } from "./palette/generate-theme-palette";

// Wrapper legado (spec v8 §7.14): "1 cor → paleta completa" sem regras de tema. O núcleo mora em
// palette/seed-tokens.ts e o gerador unificado é palette/generate-theme-palette.ts; sem regras e
// sem base, a saída é byte a byte a de antes (golden em palette/__golden__/).
export function buildFullPaletteFromSeed(seed: Oklch): { light: PaletteColorTokens; dark: PaletteColorTokens } {
  const { light, dark } = generateThemePalette({ seed, rules: {}, base: null });
  return { light: light as PaletteColorTokens, dark: dark as PaletteColorTokens };
}
