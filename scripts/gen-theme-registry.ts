// Gera (gitignored) a partir das deps @venore/theme-* do package.json:
//   src/themes/registry.generated.ts        — GENERATED_THEME_REGISTRY (merge no THEME_REGISTRY)
//   src/themes/theme-imports.generated.css  — @import "@venore/theme-<key>/theme.css" por tema
// Roda nos hooks pre* junto com gen-plugin-registry.
//
// venore-slime NÃO entra aqui — fica hardcoded em registry.ts / globals.css (fallback obrigatório,
// AGENTS.md §3). Ver docs/themes/temas-como-pacotes-plano.md.
//
// Convenção do pacote @venore/theme-<key>: exports "." (barrel com `Shell`), "./manifest"
// (`<camelKey>Manifest`), "./color-palettes" (`<CAMEL_KEY>_COLOR_PALETTES`), "./theme.css".

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const THEMES_DIR = path.join(ROOT, "src/themes");
const HEADER = "// GERADO por scripts/gen-theme-registry.ts — NÃO editar à mão (gitignored).\n";

const toCamel = (key: string) => key.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toConst = (key: string) => `${key.replace(/-/g, "_").toUpperCase()}_COLOR_PALETTES`;

function canResolve(spec: string): boolean {
  try {
    require.resolve(spec);
    return true;
  } catch {
    return false;
  }
}

const hostPkg = require(path.join(ROOT, "package.json")) as { dependencies?: Record<string, string> };
const themePackages = Object.keys(hostPkg.dependencies ?? {})
  .filter((dep) => dep.startsWith("@venore/theme-") && dep !== "@venore/theme-sdk")
  .filter((dep) => canResolve(`${dep}/manifest`))
  .sort();

const keys = themePackages.map((dep) => dep.slice("@venore/theme-".length));
const pkgFor = (key: string) => `@venore/theme-${key}`;
const paletteKeys = keys.filter((key) => canResolve(`${pkgFor(key)}/color-palettes`));

const registry =
  HEADER +
  `import type { ThemeRegistryEntry } from "./registry-types";\n` +
  keys
    .map(
      (key) =>
        `import { ${toCamel(key)}Manifest } from "${pkgFor(key)}/manifest";\n` +
        `import { Shell as ${toCamel(key)}Shell } from "${pkgFor(key)}";` +
        (paletteKeys.includes(key) ? `\nimport { ${toConst(key)} } from "${pkgFor(key)}/color-palettes";` : ""),
    )
    .join("\n") +
  `\n\nexport const GENERATED_THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {\n` +
  keys
    .map(
      (key) =>
        `  "${key}": {\n` +
        `    manifest: ${toCamel(key)}Manifest,\n` +
        `    Shell: ${toCamel(key)}Shell,\n` +
        `    colorPalettes: ${paletteKeys.includes(key) ? toConst(key) : "[]"},\n` +
        `  },`,
    )
    .join("\n") +
  `\n};\n`;

// Além do @import dos tokens, um @source por tema: Tailwind v4 nunca escaneia node_modules, e
// importar o theme.css de um pacote NÃO faz ele ler os componentes desse pacote — classe usada só
// no tema (ex: `lg:border-r-2` do Aurora) simplesmente não era gerada. Mesmo mecanismo do
// plugin-sources.generated.css (gen-plugin-registry.ts); caminho via require.resolve, relativo a
// src/themes (onde este CSS mora), sobrevive a hoisting.
const themeSource = (key: string) => {
  const themeDir = path.dirname(require.resolve(`${pkgFor(key)}/manifest`));
  return `@source "${path.relative(THEMES_DIR, themeDir).split(path.sep).join("/")}";`;
};
const cssImports =
  "/* GERADO por scripts/gen-theme-registry.ts — NÃO editar à mão (gitignored). */\n" +
  keys.map((key) => `@import "${pkgFor(key)}/theme.css";\n${themeSource(key)}`).join("\n") +
  (keys.length ? "\n" : "");

writeFileSync(path.join(THEMES_DIR, "registry.generated.ts"), registry);
writeFileSync(path.join(THEMES_DIR, "theme-imports.generated.css"), cssImports);

console.log(`gen-theme-registry: ${keys.length} tema(s) [${keys.join(", ") || "nenhum"}]`);
