import type { ColorPalette, ThemeManifest } from "@/contexts/themes/contracts/types";
import type { ThemeDefinition, ThemeShellComponent } from "@/contexts/themes/contracts/v8";

export type { ThemeShellComponent };

// Entrada do registro de temas (spec v8 §2.11). As duas variantes mantêm `manifest` no topo
// (invariante §0.3) — nenhum consumidor de `entry.manifest.*` muda.
//   contract 7: pacote 7.x, um `Shell` inteiro (renderizado pelo legacy-shell-adapter).
//   contract 8: `ThemeDefinition` (campos opcionais sobre o kit) + lineage vinda do codegen.
// colorPalettes (T3): catálogo de paletas salváveis do tema. `[]` = tema sem catálogo.
// packageVersion: version do package.json do pacote (fonte de theme-update-status.ts).
export type ThemeRegistryEntry =
  | {
      contract: 7;
      manifest: ThemeManifest;
      Shell: ThemeShellComponent;
      colorPalettes: ColorPalette[];
      packageVersion: string;
      packageName: string | null;
    }
  | {
      contract: 8;
      manifest: ThemeManifest;
      definition: ThemeDefinition;
      colorPalettes: ColorPalette[];
      packageVersion: string;
      packageName: string | null;
      lineage: readonly string[]; // [self, pai, …] do codegen
    };
