import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildThemeTokenValues } from "../../../scripts/theme-tokens";
import type { ThemeTokenValues } from "@/themes/theme-tokens.generated";

// Par de FIXTURE_THEME_REGISTRY para `@/themes/theme-tokens.generated`: os valores do codegen real
// (venore-slime + o que estiver instalado) mais os das fixtures v8, com a mesma cascata de lineage.
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

// Recebe os valores reais (importOriginal no vi.mock) para não importar o módulo mockado.
export const withFixtureThemeTokens = (real: Record<string, ThemeTokenValues>): Record<string, ThemeTokenValues> => ({
  ...real,
  ...buildThemeTokenValues(
    [
      { key: "venore-slime", css: read("src/themes/venore-slime/theme.css") },
      { key: "fixture-parent", css: read("src/test-support/themes/fixture-parent/theme.css") },
      { key: "fixture-child", css: read("src/test-support/themes/fixture-child/theme.css") },
    ],
    { "fixture-parent": ["fixture-parent", "venore-slime"], "fixture-child": ["fixture-child", "fixture-parent", "venore-slime"] },
  ),
  "venore-slime": real["venore-slime"],
});
