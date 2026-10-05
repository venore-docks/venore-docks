import type { ThemeRegistryEntry } from "@/themes/registry-types";
import type { ThemeDefinition } from "@/contexts/themes/contracts/v8";
import { fixtureChildTheme } from "./fixture-child/theme";
import { FixtureLegacyShell, fixtureLegacyManifest } from "./fixture-legacy/theme";
import { fixtureParentTheme } from "./fixture-parent/theme";

// Substituto de GENERATED_THEME_REGISTRY para testes que precisam de um tema além do venore-slime,
// sem depender de quais pacotes @venore/theme-* estão instalados no branch:
//   vi.mock("@/themes/registry.generated", async () => ({
//     GENERATED_THEME_REGISTRY: (await import("@/test-support/themes/fixture-registry")).FIXTURE_THEME_REGISTRY,
//   }));
function v8Entry(definition: ThemeDefinition, lineage: readonly string[]): ThemeRegistryEntry {
  return {
    contract: 8,
    manifest: definition.manifest,
    definition,
    colorPalettes: definition.colorPalettes ?? [],
    packageVersion: definition.manifest.version,
    packageName: `@venore/theme-${definition.manifest.key}`,
    lineage,
  };
}

export const FIXTURE_THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
  "fixture-parent": v8Entry(fixtureParentTheme, ["fixture-parent", "venore-slime"]),
  "fixture-child": v8Entry(fixtureChildTheme, ["fixture-child", "fixture-parent", "venore-slime"]),
  "fixture-legacy": {
    contract: 7,
    manifest: fixtureLegacyManifest,
    Shell: FixtureLegacyShell,
    colorPalettes: [],
    packageVersion: fixtureLegacyManifest.version,
    packageName: "@venore/theme-fixture-legacy",
  },
};
