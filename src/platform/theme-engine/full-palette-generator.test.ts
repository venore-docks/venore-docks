import { describe, expect, it } from "vitest";
import { hexToOklch } from "./oklch-color";
import { buildFullPaletteFromSeed } from "./full-palette-generator";

const ALL_TOKENS = [
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "background",
  "foreground",
  "accent",
  "accent-foreground",
  "ring",
] as const;

// Distância circular entre 2 matizes (0-180°): 0 = mesmo matiz, 180 = complementar.
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

describe("buildFullPaletteFromSeed", () => {
  it("preenche os 9 tokens, nos dois modos, todos em hex válido", () => {
    const result = buildFullPaletteFromSeed(hexToOklch("#006b82"));

    for (const mode of ["light", "dark"] as const) {
      for (const token of ALL_TOKENS) {
        expect(result[mode][token]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("accent usa o matiz complementar (oposto no círculo), não o mesmo da primária", () => {
    const seed = hexToOklch("#006b82"); // petróleo/teal
    const { light } = buildFullPaletteFromSeed(seed);

    const primaryHue = hexToOklch(light.primary!).h;
    const accentHue = hexToOklch(light.accent!).h;
    // ~180° de diferença, com folga pra arredondamento do clamp de gamut.
    expect(hueDistance(primaryHue, accentHue)).toBeGreaterThan(165);
  });

  it("secondary/background carregam um traço do matiz da primária (shade), não ficam cinza puro", () => {
    const seed = hexToOklch("#006b82");
    const { light } = buildFullPaletteFromSeed(seed);

    const primaryHue = hexToOklch(light.primary!).h;
    const secondaryHue = hexToOklch(light.secondary!).h;
    // Chroma baixa deixa o hue mais sensível a ruído de arredondamento — folga generosa, o que
    // importa é estar perto do matiz da primária (mesmo eixo), não em qualquer canto do círculo.
    expect(hexToOklch(light.secondary!).c).toBeGreaterThan(0);
    expect(hueDistance(primaryHue, secondaryHue)).toBeLessThan(15);
  });

  it("contraste texto/fundo é alto nos dois modos (evita o problema anterior de tokens pretos)", () => {
    const result = buildFullPaletteFromSeed(hexToOklch("#c0392b"));
    for (const mode of ["light", "dark"] as const) {
      const bgL = hexToOklch(result[mode].background!).l;
      const fgL = hexToOklch(result[mode].foreground!).l;
      expect(Math.abs(bgL - fgL)).toBeGreaterThan(0.5);
    }
  });

  it("modo escuro clareia uma cor de entrada bem escura o suficiente pra continuar visível", () => {
    const veryDark = hexToOklch("#1a0d2e");
    const { dark } = buildFullPaletteFromSeed(veryDark);
    expect(hexToOklch(dark.primary!).l).toBeGreaterThan(veryDark.l);
  });
});
