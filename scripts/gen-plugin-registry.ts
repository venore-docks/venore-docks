// Gera src/plugins/{registry,route-registry,contributions,contributions.client,plugin-keys,
// plugin-barrels}.generated.ts + plugin-sources.generated.css (gitignored). Roda em postinstall /
// predev / prebuild / pretypecheck / pretest.
//
// MODELO DE PACOTE (docs/plugins-repos-separados-plano.md): cada plugin é um pacote npm
// `@venore/plugin-<key>` listado nas `dependencies` do package.json do venore-docks. O codegen
// descobre os plugins instalados a partir dessas deps e resolve os subpaths que cada pacote
// expõe (`./manifest`, `./route-table`, `./contributions`, `./contributions-client`). Um plugin
// não instalado simplesmente não entra — nenhum import fixo pra quebrar o build.
//
// Convenção do pacote: `<camelKey>Manifest` em "./manifest", `<camelKey>RouteTable` em
// "./route-table", `<camelKey>Contributions` em "./contributions", `<camelKey>ClientContributions`
// em "./contributions-client". camelKey = key kebab -> camelCase ("company-metrics" ->
// "companyMetrics"). O pacote também expõe "." (barrel) pra importActivePluginBarrel.

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const PLUGINS_DIR = path.join(ROOT, "src/plugins");
const HEADER = "// GERADO por scripts/gen-plugin-registry.ts — NÃO editar à mão (gitignored).\n";

function toCamel(key: string): string {
  return key.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function canResolve(spec: string): boolean {
  try {
    require.resolve(spec);
    return true;
  } catch {
    return false;
  }
}

// package.json do venore-docks -> deps @venore/plugin-* (menos o SDK). Só as que resolvem de fato
// (npm install já rodou / pacote presente).
const hostPkg = require(path.join(ROOT, "package.json")) as { dependencies?: Record<string, string> };
const pluginPackages = Object.keys(hostPkg.dependencies ?? {})
  .filter((dep) => dep.startsWith("@venore/plugin-") && dep !== "@venore/plugin-sdk")
  .filter((dep) => canResolve(`${dep}/manifest`))
  .sort();

const keys = pluginPackages.map((dep) => dep.slice("@venore/plugin-".length));
const pkgFor = (key: string) => `@venore/plugin-${key}`;

const routeKeys = keys.filter((key) => canResolve(`${pkgFor(key)}/route-table`));
const contributionKeys = keys.filter((key) => canResolve(`${pkgFor(key)}/contributions`));
const clientContributionKeys = keys.filter((key) => canResolve(`${pkgFor(key)}/contributions-client`));

const registry =
  HEADER +
  `import type { PluginManifest } from "@/platform/plugin-engine/manifest-schema";\n` +
  keys.map((key) => `import { ${toCamel(key)}Manifest } from "${pkgFor(key)}/manifest";`).join("\n") +
  `\n\nexport const PLUGIN_REGISTRY: PluginManifest[] = [\n` +
  keys.map((key) => `  ${toCamel(key)}Manifest,`).join("\n") +
  `\n];\n`;

const routeRegistry =
  HEADER +
  `import type { PluginRouteTable } from "@/platform/plugin-routing/types";\n` +
  routeKeys.map((key) => `import { ${toCamel(key)}RouteTable } from "${pkgFor(key)}/route-table";`).join("\n") +
  `\n\nexport const PLUGIN_ROUTE_TABLES: Record<string, PluginRouteTable> = {\n` +
  routeKeys.map((key) => `  "${key}": ${toCamel(key)}RouteTable,`).join("\n") +
  `\n};\n`;

const contributionsRegistry =
  HEADER +
  `import type { PluginContributions } from "@/platform/plugin-engine/plugin-contributions";\n` +
  contributionKeys.map((key) => `import { ${toCamel(key)}Contributions } from "${pkgFor(key)}/contributions";`).join("\n") +
  `\n\nexport const PLUGIN_CONTRIBUTIONS: Record<string, PluginContributions> = {\n` +
  contributionKeys.map((key) => `  "${key}": ${toCamel(key)}Contributions,`).join("\n") +
  `\n};\n`;

const clientContributionsRegistry =
  HEADER +
  `import type { PluginClientContributions } from "@/platform/page-builder/plugin-client-contributions";\n` +
  clientContributionKeys
    .map((key) => `import { ${toCamel(key)}ClientContributions } from "${pkgFor(key)}/contributions-client";`)
    .join("\n") +
  `\n\nexport const PLUGIN_CLIENT_CONTRIBUTIONS: Record<string, PluginClientContributions> = {\n` +
  clientContributionKeys.map((key) => `  "${key}": ${toCamel(key)}ClientContributions,`).join("\n") +
  `\n};\n`;

// Módulo folha — sem imports. Consumido por observability/origin-registry.ts (muito central).
const pluginKeys = HEADER + `export const PLUGIN_KEYS: string[] = [${keys.map((k) => `"${k}"`).join(", ")}];\n`;

// key -> loader preguiçoso do barrel do pacote. Usado por importActivePluginBarrel (dep opcional
// cross-plugin). Plugin ausente não tem entrada.
const pluginBarrels =
  HEADER +
  `export const PLUGIN_BARRELS: Record<string, () => Promise<unknown>> = {\n` +
  keys.map((key) => `  "${key}": () => import("${pkgFor(key)}"),`).join("\n") +
  `\n};\n`;

// Tailwind v4 nunca escaneia node_modules por padrão (mesmo se não estivesse em .gitignore) —
// sem isso, qualquer classe usada SÓ dentro de um pacote de plugin (nunca replicada em src/)
// simplesmente não é gerada no CSS final: a estrutura HTML renderiza, mas padding/gap/margin/
// radius daquela classe ficam mudos. Achado real: view de saída do broadcast "com o layout todo
// quebrado, sumiram os espaçamentos". `@source` resolvido via require.resolve (não um caminho
// relativo fixo) — sobrevive a hoisting/estrutura de node_modules diferente. Consumido por
// globals.css (@import "../plugins/plugin-sources.generated.css").
const pluginSourcesCss =
  `/* GERADO por scripts/gen-plugin-registry.ts — NÃO editar à mão (gitignored). */\n` +
  keys
    .map((key) => {
      const pluginDir = path.dirname(require.resolve(`${pkgFor(key)}/manifest`));
      const relativePath = path.relative(PLUGINS_DIR, pluginDir).split(path.sep).join("/");
      return `@source "${relativePath}";`;
    })
    .join("\n") +
  (keys.length > 0 ? "\n" : "");

writeFileSync(path.join(PLUGINS_DIR, "registry.generated.ts"), registry);
writeFileSync(path.join(PLUGINS_DIR, "route-registry.generated.ts"), routeRegistry);
writeFileSync(path.join(PLUGINS_DIR, "contributions.generated.ts"), contributionsRegistry);
writeFileSync(path.join(PLUGINS_DIR, "contributions.client.generated.ts"), clientContributionsRegistry);
writeFileSync(path.join(PLUGINS_DIR, "plugin-keys.generated.ts"), pluginKeys);
writeFileSync(path.join(PLUGINS_DIR, "plugin-barrels.generated.ts"), pluginBarrels);
writeFileSync(path.join(PLUGINS_DIR, "plugin-sources.generated.css"), pluginSourcesCss);

console.log(
  `gen-plugin-registry: ${keys.length} plugin(s) [${keys.join(", ")}]; ` +
    `${routeKeys.length} com route-table; ${contributionKeys.length} com contributions; ` +
    `${clientContributionKeys.length} com contributions-client`,
);
