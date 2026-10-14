import { describe, expect, it } from "vitest";
import { buildFullPaletteFromSeed } from "../full-palette-generator";
import { hexToOklch } from "../oklch-color";
import { generateHueRotationPalettes, THEME_HUE_PRESETS } from "@/themes/generate-hue-rotation-palettes";
import golden from "./__golden__/legacy-generators.golden.json";

// Golden dos geradores legados (spec v8 §7.14): o JSON foi gravado ANTES do gerador unificado
// existir. buildFullPaletteFromSeed virou wrapper de generateThemePalette e generateHueRotationPalettes
// continua sendo o catálogo do @venore/theme-sdk/palettes — a saída dos dois não pode mudar.
describe("geradores legados — saída idêntica ao golden", () => {
  for (const [hex, expected] of Object.entries(golden.fullFromHex)) {
    it(`buildFullPaletteFromSeed(${hex})`, () => {
      expect(buildFullPaletteFromSeed(hexToOklch(hex))).toEqual(expected);
    });
  }

  it("buildFullPaletteFromSeed com sementes OKLCH", () => {
    for (const { seed, palette } of golden.fullFromOklch) {
      expect(buildFullPaletteFromSeed(seed)).toEqual(palette);
    }
  });

  it("generateHueRotationPalettes", () => {
    expect(generateHueRotationPalettes(golden.hueRotation.base, THEME_HUE_PRESETS)).toEqual(golden.hueRotation.palettes);
  });
});
