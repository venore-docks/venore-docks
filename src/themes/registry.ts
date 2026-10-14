import * as venoreSlime from "./venore-slime";
import { GENERATED_THEME_REGISTRY } from "./registry.generated";
import type { ThemeRegistryEntry } from "./registry-types";

export type { ThemeShellComponent, ThemeRegistryEntry } from "./registry-types";

// Registro dos temas (docs/venore-docks.md — "Sobre temas"; docs/themes/theme-system-v8.md).
// `venore-slime` é o único tema que vive em src/themes/ (fallback obrigatório do sistema,
// AGENTS.md §3) e entra aqui hardcoded — desde a v8 como `contract: 8` (o slime É o kit:
// `defineTheme({ manifest, layout: "topbar" })`). Todo o resto vem de GENERATED_THEME_REGISTRY — os
// pacotes @venore/theme-* descobertos a partir das deps do package.json
// (scripts/gen-theme-registry.ts), 7.x (Shell inteiro) ou 8.x (ThemeDefinition).
export const THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
  "venore-slime": {
    contract: 8,
    manifest: venoreSlime.venoreSlimeManifest,
    definition: venoreSlime.venoreSlimeTheme,
    colorPalettes: venoreSlime.VENORE_SLIME_COLOR_PALETTES,
    packageVersion: venoreSlime.venoreSlimeManifest.version,
    packageName: null,
    lineage: ["venore-slime"],
  },
  ...GENERATED_THEME_REGISTRY,
};
