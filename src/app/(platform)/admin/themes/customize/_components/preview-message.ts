import type { ThemeConfigDocument, ThemeOptionField } from "@/contexts/themes/contracts/v8";
import { PREVIEW_BRIDGE_UPDATE, type PreviewBridgeUpdate } from "@/theme-sdk/kit/preview-bridge";

// Mensagem de edição instantânea para o PreviewBridge do iframe: as cores da paleta escolhida
// (custom/seed — preset e default precisam do CSS do servidor, então só valem depois de salvar) e
// as opções do tema em edição. O bridge revalida cada valor do lado de lá.
export function buildPreviewMessage(document: ThemeConfigDocument, fields: readonly ThemeOptionField[]): PreviewBridgeUpdate {
  const entry = document.byTheme[document.themeKey];
  const palette = entry?.palette;
  const tokens =
    palette?.mode === "custom"
      ? { light: palette.light, dark: palette.dark }
      : palette?.mode === "seed"
        ? { light: palette.generated.light, dark: palette.generated.dark }
        : undefined;
  const optionUnits: Record<string, string> = {};
  for (const field of fields) if (field.type === "range") optionUnits[field.key] = field.unit;
  return { type: PREVIEW_BRIDGE_UPDATE, tokens, options: entry?.options ?? {}, optionUnits };
}
