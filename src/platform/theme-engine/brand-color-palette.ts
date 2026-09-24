import type { OperationResult } from "@/shared/types";
import { resolveActiveTheme } from "@/platform/theme-rendering/resolve-active-theme";
import { hexToOklch, isValidHexColor, parseOklchNumeric } from "./oklch-color";
import { buildFullPaletteFromSeed } from "./full-palette-generator";
import { setCustomColorPalette } from "./custom-color-palette";

// "1 cor de marca": o admin escolhe 1 hex, buildFullPaletteFromSeed monta a paleta completa (9
// tokens, os dois modos) em cima dela — sobrescreve a paleta personalizada inteira (não mescla:
// agora que os 9 tokens são sempre gerados de uma vez, não sobra nada "só do tema" pra preservar,
// ao contrário da versão anterior que só tocava 5 tokens de marca). O admin ainda pode reabrir
// "Avançado" e ajustar qualquer token à mão depois — isso sim é uma edição em cima do que foi
// salvo aqui, via updateCustomColorPaletteAction.
export async function setBrandColorPalette(input: { hex: string }): Promise<OperationResult<{ id: string }>> {
  if (!isValidHexColor(input.hex)) {
    return {
      success: false,
      error: {
        code: "theme-engine.brand_color_palette.invalid_value",
        message: "Cor de marca precisa ser um hexadecimal válido (#rrggbb).",
      },
    };
  }

  const { manifest } = await resolveActiveTheme();
  const palette = buildFullPaletteFromSeed(hexToOklch(input.hex));
  return setCustomColorPalette(manifest.key, palette);
}

// Presets do catálogo (Espaço/Ametista/Âmbar/Rubro, + o que cada tema tiver de próprio) — em vez
// de só ativar o preset estático do pacote do tema (que só define 5 tokens de marca, herdados do
// generateHueRotationPalettes de @venore/theme-sdk — fora do alcance deste repo pra ampliar sem
// mexer nos 16 pacotes de tema), extrai o `primary` já resolvido do preset como semente e roda
// pelo MESMO gerador do "1 cor de marca": o preset vira um atalho pra uma paleta completa, salva
// e ativada como "Personalizada" — não como o id do preset em si (por isso não usa
// activateColorPalette diretamente).
export async function setPresetColorPalette(paletteId: string): Promise<OperationResult<{ id: string }>> {
  const { manifest, colorPalettes } = await resolveActiveTheme();
  const preset = colorPalettes.find((candidate) => candidate.id === paletteId);
  if (!preset) {
    return {
      success: false,
      error: {
        code: "theme-engine.brand_color_palette.preset_not_found",
        message: `Paleta "${paletteId}" não existe no catálogo do tema ativo.`,
      },
    };
  }

  const seedValue = preset.light.primary ?? preset.dark.primary;
  const seed = seedValue ? parseOklchNumeric(seedValue) : null;
  if (!seed) {
    return {
      success: false,
      error: {
        code: "theme-engine.brand_color_palette.preset_invalid",
        message: `Paleta "${paletteId}" não tem uma cor primária utilizável.`,
      },
    };
  }

  const palette = buildFullPaletteFromSeed(seed);
  return setCustomColorPalette(manifest.key, palette);
}
