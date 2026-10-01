import semver from "semver";
import type { ThemeDefinition } from "@/contexts/themes/contracts/v8";
import { V8_THEME_CONTRACT_RANGE } from "@/contexts/themes/contracts/contract-version";

// @venore/theme-sdk/define — identidade tipada pra declarar um tema v8 (spec §2.10). Em dev,
// confere o básico do manifesto; nunca altera a definição.
export function defineTheme<const T extends ThemeDefinition>(def: T): T {
  if (process.env.NODE_ENV !== "production") {
    const version = def.manifest.themeContractVersion;
    if (!semver.valid(version) || !semver.satisfies(version, V8_THEME_CONTRACT_RANGE)) {
      console.warn(
        `[theme-sdk] defineTheme("${def.manifest.key}"): themeContractVersion "${version}" fora de ${V8_THEME_CONTRACT_RANGE}.`,
      );
    }
  }
  return def;
}
