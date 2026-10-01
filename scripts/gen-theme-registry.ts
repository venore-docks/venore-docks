// Gera (gitignored) a partir das deps @venore/theme-* do package.json (spec v8 §5):
//   src/themes/registry.generated.ts         — GENERATED_THEME_REGISTRY (entradas contract 7 | 8)
//   src/themes/registry.client.generated.ts  — THEME_CLIENT_REGISTRY ("use client", lazy por tema)
//   src/themes/theme-imports.generated.css   — @import "<pkg>/theme.css" + @source por tema
//   src/themes/theme-lineage.generated.css   — CSS de herança (W9; vazio na Fase F)
//   src/themes/theme-tokens.generated.ts     — tokens parseados por tema (W1; vazio na Fase F)
//   src/themes/theme-report.generated.json   — erros/avisos/excluídos (registry.test falha com erro)
// Roda nos hooks pre* junto com gen-plugin-registry.
//
// `--strict` (prebuild): tema inválido derruba o build — o deploy anterior continua no ar.
// Sem a flag (postinstall/predev): avisa, exclui o tema e registra no relatório.
//
// venore-slime NÃO entra aqui — fica hardcoded em registry.ts / globals.css (fallback obrigatório,
// AGENTS.md §3); um pacote que tente usar essa chave é erro.
//
// Pacote 7.x: exports "." (barrel com `Shell`), "./manifest" (`<camelKey>Manifest`),
// "./color-palettes" (`<CAMEL_KEY>_COLOR_PALETTES`), "./theme.css".
// Pacote 8.x: package.json `"venoreTheme": { "contract": "8.x", "key": "<key>", "extends"?: "<pai>" }`
// e export "./theme" com `export default defineTheme({...})`; opcional "./theme-client".

import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildThemeRegistry, type ThemePackageInput } from "./lib/theme-registry-codegen";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const THEMES_DIR = path.join(ROOT, "src/themes");
const strict = process.argv.includes("--strict");

function resolveOrNull(spec: string): string | null {
  try {
    return require.resolve(spec);
  } catch {
    return null;
  }
}

// O package.json do pacote nem sempre está em "exports" — sobe a partir de um entry resolvido.
function readPackageJson(entryFile: string): ThemePackageInput["packageJson"] & { name?: string } {
  let dir = path.dirname(entryFile);
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "package.json");
    if (existsSync(candidate)) {
      const parsed = JSON.parse(readFileSync(candidate, "utf-8")) as { name?: string };
      if (parsed.name?.startsWith("@venore/theme-")) return parsed;
    }
    dir = path.dirname(dir);
  }
  return {};
}

const hostPkg = require(path.join(ROOT, "package.json")) as { dependencies?: Record<string, string> };
const inputs: ThemePackageInput[] = Object.keys(hostPkg.dependencies ?? {})
  .filter((dep) => dep.startsWith("@venore/theme-") && dep !== "@venore/theme-sdk")
  .flatMap((dep) => {
    const manifestFile = resolveOrNull(`${dep}/manifest`);
    const themeFile = resolveOrNull(`${dep}/theme`);
    const anchor = manifestFile ?? themeFile;
    if (!anchor) return [];
    return [
      {
        dep,
        packageJson: readPackageJson(anchor),
        resolvable: {
          manifest: Boolean(manifestFile),
          theme: Boolean(themeFile),
          colorPalettes: Boolean(resolveOrNull(`${dep}/color-palettes`)),
          themeClient: Boolean(resolveOrNull(`${dep}/theme-client`)),
        },
        // Caminho via require.resolve, relativo a src/themes (onde o CSS gerado mora) — sobrevive a hoisting.
        sourceDir: path.relative(THEMES_DIR, path.dirname(anchor)).split(path.sep).join("/"),
      },
    ];
  });

const output = buildThemeRegistry(inputs, { strict });

writeFileSync(path.join(THEMES_DIR, "registry.generated.ts"), output.registry);
writeFileSync(path.join(THEMES_DIR, "registry.client.generated.ts"), output.clientRegistry);
writeFileSync(path.join(THEMES_DIR, "theme-imports.generated.css"), output.cssImports);
writeFileSync(path.join(THEMES_DIR, "theme-lineage.generated.css"), output.lineageCss);
writeFileSync(path.join(THEMES_DIR, "theme-tokens.generated.ts"), output.tokensModule);
writeFileSync(path.join(THEMES_DIR, "theme-report.generated.json"), JSON.stringify(output.report, null, 2) + "\n");

for (const issue of output.report.issues) {
  console.warn(`gen-theme-registry: ${issue.level} [${issue.themeKey}] ${issue.code}: ${issue.message}`);
}
const keys = output.report.themes.map((theme) => `${theme.key}@${theme.packageVersion}${theme.contract === 8 ? " (v8)" : ""}`);
console.log(`gen-theme-registry${strict ? " --strict" : ""}: ${keys.length} tema(s) [${keys.join(", ") || "nenhum"}]`);
