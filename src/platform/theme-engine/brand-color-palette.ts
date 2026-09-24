import type { ColorPalette, PaletteColorToken, PaletteColorTokens } from "@/contexts/themes";
import type { OperationResult } from "@/shared/types";
import { withHue } from "@/themes/generate-hue-rotation-palettes";
import { resolveActiveTheme } from "@/platform/theme-rendering/resolve-active-theme";
import { hexToOklch, isValidHexColor, oklchToHex, parseOklchNumeric } from "./oklch-color";
import { getCustomColorPalette, setCustomColorPalette } from "./custom-color-palette";

// "1 cor de marca": o admin escolhe 1 hex, giramos o matiz (hue) dele sobre os 5 tokens que
// carregam a identidade visual de um tema (confirmado comparando venore-theme-aurora/theme.css
// com venore-theme-harbor/theme.css — Harbor é um recolor manual do Aurora pra FEM que girou o
// matiz de TODOS os tokens, mas só primary/accent/ring têm chroma que importa visualmente; os
// demais são quase-neutros). Mesma primitiva "mantém L/C, troca H" que já move os presets do
// catálogo (Oceano/Ametista/Âmbar/Rubro) — aqui aplicada a 1 hue só, extraído do hex do admin em
// vez de vir de um preset fixo.
const BRAND_HUE_TOKENS: readonly PaletteColorToken[] = [
  "primary",
  "primary-foreground",
  "accent",
  "accent-foreground",
  "ring",
];

export type BuildBrandHueTokensResult = { light: PaletteColorTokens; dark: PaletteColorTokens };

// Pura — sem I/O, fácil de testar sem mock. `template` é qualquer ColorPalette do catálogo do
// tema ativo (colorPalettes[0] serve — todo preset de um tema compartilha o mesmo L/C por
// construção, generateHueRotationPalettes só troca o H). Tokens ausentes no template são pulados,
// não erro (mesma filosofia "devolve como está" de withHue).
export function buildBrandHueTokens(hex: string, template: ColorPalette): OperationResult<BuildBrandHueTokensResult> {
  if (!isValidHexColor(hex)) {
    return {
      success: false,
      error: {
        code: "theme-engine.brand_color_palette.invalid_value",
        message: "Cor de marca precisa ser um hexadecimal válido (#rrggbb).",
      },
    };
  }

  const { h: hue } = hexToOklch(hex);

  function rehueMode(templateTokens: PaletteColorTokens): PaletteColorTokens {
    const result: PaletteColorTokens = {};
    for (const token of BRAND_HUE_TOKENS) {
      const templateValue = templateTokens[token];
      if (!templateValue) continue;
      const rotated = withHue(templateValue, hue);
      const numeric = parseOklchNumeric(rotated);
      if (!numeric) continue;
      result[token] = oklchToHex(numeric.l, numeric.c, numeric.h);
    }
    return result;
  }

  const light = rehueMode(template.light);
  const dark = rehueMode(template.dark);

  if (Object.keys(light).length === 0 && Object.keys(dark).length === 0) {
    return {
      success: false,
      error: {
        code: "theme-engine.brand_color_palette.empty_template",
        message: "Tema ativo não tem tokens de marca na paleta base — não é possível derivar a cor.",
      },
    };
  }

  return { success: true, data: { light, dark } };
}

export async function setBrandColorPalette(input: { hex: string }): Promise<OperationResult<{ id: string }>> {
  const { manifest, colorPalettes } = await resolveActiveTheme();

  if (colorPalettes.length === 0) {
    return {
      success: false,
      error: {
        code: "theme-engine.brand_color_palette.no_catalog",
        message: "Tema ativo não tem catálogo de paletas — não é possível derivar a cor de marca.",
      },
    };
  }

  // Qualquer preset do catálogo serve de template de L/C — todos compartilham os mesmos L/C do
  // tema, só o hue difere entre eles (generateHueRotationPalettes).
  const built = buildBrandHueTokens(input.hex, colorPalettes[0]);
  if (!built.success) return built;

  // Mescla (não sobrescreve): preserva qualquer token estrutural (secondary/background/foreground/
  // etc.) que o admin já tenha ajustado na seção Avançado — só os 5 tokens de marca são
  // substituídos pela nova derivação.
  const current = await getCustomColorPalette(manifest.key);
  const merged = {
    light: { ...current.light, ...built.data.light },
    dark: { ...current.dark, ...built.data.dark },
  };

  return setCustomColorPalette(manifest.key, merged);
}
