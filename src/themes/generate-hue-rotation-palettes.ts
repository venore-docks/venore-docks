import type { ColorPalette } from "@/contexts/themes/contracts/types";

// Gera o catálogo de paletas de um tema girando SÓ o hue dos tokens de "hue de marca"
// (primary/accent + -foreground + ring), mantendo L e C da paleta base daquele theme.css — o
// mesmo princípio que o catálogo do venore-slime já seguia à mão ("hue é o único eixo que muda
// entre presets", src/themes/venore-slime/color-palettes.ts). Assim todo tema ganha um catálogo
// consistente com a própria base, sem redigitar oklch por preset.

type BrandHueTokens = {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
};

export type HueRotationBase = { light: BrandHueTokens; dark: BrandHueTokens };

export type HueRotationPreset = { id: string; name: string; primaryHue: number; accentHue: number };

function parseOklch(value: string): { l: string; c: string } | null {
  const match = value.match(/oklch\(\s*([^\s]+)\s+([^\s]+)\s+[^)]+\)/i);
  return match ? { l: match[1], c: match[2] } : null;
}

function withHue(value: string, hue: number): string {
  const parsed = parseOklch(value);
  // Valor inesperado (não-oklch): devolve como está — melhor que quebrar o catálogo.
  return parsed ? `oklch(${parsed.l} ${parsed.c} ${hue})` : value;
}

function rotate(tokens: BrandHueTokens, preset: HueRotationPreset) {
  return {
    primary: withHue(tokens.primary, preset.primaryHue),
    "primary-foreground": withHue(tokens.primaryForeground, preset.primaryHue),
    accent: withHue(tokens.accent, preset.accentHue),
    "accent-foreground": withHue(tokens.accentForeground, preset.accentHue),
    ring: withHue(tokens.ring, preset.primaryHue),
  };
}

export function generateHueRotationPalettes(base: HueRotationBase, presets: HueRotationPreset[]): ColorPalette[] {
  return presets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    light: rotate(base.light, preset),
    dark: rotate(base.dark, preset),
  }));
}

// Catálogo padrão que todo tema usa (4 hues bem separados na roda de cor). Um tema pode passar
// a própria lista se quiser outra seleção.
export const THEME_HUE_PRESETS: HueRotationPreset[] = [
  { id: "oceano", name: "Oceano", primaryHue: 245, accentHue: 210 },
  { id: "ametista", name: "Ametista", primaryHue: 315, accentHue: 300 },
  { id: "ambar", name: "Âmbar", primaryHue: 70, accentHue: 90 },
  { id: "rubro", name: "Rubro", primaryHue: 25, accentHue: 15 },
];
