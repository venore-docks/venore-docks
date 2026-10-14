import { defineTheme } from "@/theme-sdk/define";
import { venoreSlimeManifest } from "./manifest";
import { VENORE_SLIME_COLOR_PALETTES } from "./color-palettes";

// O venore-slime é o kit (spec §0.1): a definição v8 só declara o manifesto e o layout "topbar";
// regiões, templates e estados caem todos no padrão do kit (src/theme-sdk/kit).
export const venoreSlimeTheme = defineTheme({
  manifest: venoreSlimeManifest,
  layout: "topbar",
  colorPalettes: VENORE_SLIME_COLOR_PALETTES,
});
