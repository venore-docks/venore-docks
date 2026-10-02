// Núcleo PURO do codegen de temas (spec v8 §5). scripts/gen-theme-registry.ts lê o disco e chama
// isto; src/themes/theme-registry-codegen.test.ts testa sem disco. Dono: Fase F (W9 pluga a
// lineage em `lineageCss`, W1 o parser de tokens em `tokensModule`).
import semver from "semver";
import { buildThemeLineage } from "../theme-lineage";
import { buildThemeTokensModule } from "../theme-tokens";

export type ThemePackageInput = {
  dep: string; // "@venore/theme-<key>"
  packageJson: { version?: string; venoreTheme?: { contract?: string; key?: string; extends?: string } };
  // Quais subpaths do pacote resolvem.
  resolvable: { manifest: boolean; theme: boolean; colorPalettes: boolean; themeClient: boolean };
  sourceDir: string; // diretório do pacote relativo a src/themes (pro @source do Tailwind)
  themeCss?: string; // conteúdo do theme.css do pacote (W1: parser de tokens); ausente = sem tokens
};

export type ThemeReportIssue = { level: "error" | "warning"; themeKey: string; code: string; message: string };
export type ThemeReport = {
  generatedAt: string;
  strict: boolean;
  themes: { key: string; packageName: string; packageVersion: string; contract: 7 | 8; lineage: string[] }[];
  excluded: string[];
  issues: ThemeReportIssue[];
};

export type ThemeCodegenOutput = {
  registry: string;
  clientRegistry: string;
  cssImports: string;
  lineageCss: string;
  tokensModule: string;
  report: ThemeReport;
};

const HEADER = "// GERADO por scripts/gen-theme-registry.ts — NÃO editar à mão (gitignored).\n";
const CSS_HEADER = "/* GERADO por scripts/gen-theme-registry.ts — NÃO editar à mão (gitignored). */\n";
const RESERVED_KEY = "venore-slime";
const MAX_CHAIN_DEPTH = 3;

const toCamel = (key: string) => key.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toConst = (key: string) => `${key.replace(/-/g, "_").toUpperCase()}_COLOR_PALETTES`;

export class ThemeCodegenError extends Error {
  constructor(readonly issues: ThemeReportIssue[]) {
    super(`gen-theme-registry (strict): ${issues.map((issue) => `[${issue.themeKey}] ${issue.message}`).join("; ")}`);
  }
}

export function buildThemeRegistry(
  packages: ThemePackageInput[],
  options: { strict: boolean; now?: Date; slimeCss?: string },
): ThemeCodegenOutput {
  const issues: ThemeReportIssue[] = [];
  const error = (themeKey: string, code: string, message: string) => issues.push({ level: "error", themeKey, code, message });

  type Planned = { key: string; input: ThemePackageInput; contract: 7 | 8; version: string; extendsKey: string | null };
  const planned: Planned[] = [];
  const seen = new Set<string>();

  for (const input of [...packages].sort((a, b) => a.dep.localeCompare(b.dep))) {
    const key = input.dep.slice("@venore/theme-".length);
    if (key === RESERVED_KEY) {
      error(key, "reserved-key", `"${input.dep}" usa a chave reservada "${RESERVED_KEY}" (fallback embutido no core).`);
      continue;
    }
    if (seen.has(key)) {
      error(key, "duplicate-key", `chave de tema duplicada "${key}".`);
      continue;
    }
    if (!input.resolvable.manifest && !input.resolvable.theme) continue; // não é pacote de tema
    seen.add(key);

    const venoreTheme = input.packageJson.venoreTheme;
    const isV8 = Boolean(venoreTheme?.contract && semver.valid(venoreTheme.contract) && semver.satisfies(venoreTheme.contract, "^8.0.0"));
    if (isV8) {
      if (!input.resolvable.theme) {
        error(key, "missing-theme-entry", `"${input.dep}" declara venoreTheme.contract ${venoreTheme?.contract} mas não exporta "./theme".`);
        continue;
      }
      if (venoreTheme?.key && venoreTheme.key !== key) {
        error(key, "key-mismatch", `venoreTheme.key "${venoreTheme.key}" difere da chave do pacote "${key}".`);
        continue;
      }
    } else if (!input.resolvable.manifest) {
      error(key, "missing-manifest", `"${input.dep}" não exporta "./manifest".`);
      continue;
    }
    planned.push({
      key,
      input,
      contract: isV8 ? 8 : 7,
      version: input.packageJson.version ?? "0.0.0",
      extendsKey: isV8 ? (venoreTheme?.extends ?? null) : null,
    });
  }

  // Lineage [self, pai, avô…] a partir de venoreTheme.extends. Pai pode ser o venore-slime.
  const byKey = new Map(planned.map((entry) => [entry.key, entry]));
  const lineageOf = (entry: Planned): string[] | null => {
    const chain = [entry.key];
    let parent = entry.extendsKey;
    while (parent) {
      if (chain.includes(parent)) {
        error(entry.key, "extends-cycle", `ciclo em extends: ${[...chain, parent].join(" → ")}.`);
        return null;
      }
      chain.push(parent);
      if (chain.length > MAX_CHAIN_DEPTH) {
        error(entry.key, "extends-depth", `cadeia de extends maior que ${MAX_CHAIN_DEPTH}: ${chain.join(" → ")}.`);
        return null;
      }
      if (parent === RESERVED_KEY) break;
      const next = byKey.get(parent);
      if (!next) {
        error(entry.key, "extends-unknown", `tema pai "${parent}" não está instalado.`);
        return null;
      }
      parent = next.extendsKey;
    }
    return chain;
  };

  const included: (Planned & { lineage: string[] })[] = [];
  for (const entry of planned) {
    const lineage = lineageOf(entry);
    if (lineage) included.push({ ...entry, lineage });
  }

  if (options.strict && issues.some((issue) => issue.level === "error")) {
    throw new ThemeCodegenError(issues.filter((issue) => issue.level === "error"));
  }

  const imports = included
    .map(({ key, contract, input }) => {
      const camel = toCamel(key);
      if (contract === 8) return `import ${camel}Theme from "${input.dep}/theme";`;
      return (
        `import { ${camel}Manifest } from "${input.dep}/manifest";\n` +
        `import { Shell as ${camel}Shell } from "${input.dep}";` +
        (input.resolvable.colorPalettes ? `\nimport { ${toConst(key)} } from "${input.dep}/color-palettes";` : "")
      );
    })
    .join("\n");

  const entries = included
    .map(({ key, contract, input, version, lineage }) => {
      const camel = toCamel(key);
      const common = `    packageVersion: ${JSON.stringify(version)},\n    packageName: ${JSON.stringify(input.dep)},\n`;
      if (contract === 8) {
        return (
          `  ${JSON.stringify(key)}: {\n    contract: 8,\n    manifest: ${camel}Theme.manifest,\n    definition: ${camel}Theme,\n` +
          `    colorPalettes: ${camel}Theme.colorPalettes ?? [],\n${common}    lineage: ${JSON.stringify(lineage)},\n  },`
        );
      }
      return (
        `  ${JSON.stringify(key)}: {\n    contract: 7,\n    manifest: ${camel}Manifest,\n    Shell: ${camel}Shell,\n` +
        `    colorPalettes: ${input.resolvable.colorPalettes ? toConst(key) : "[]"},\n${common}  },`
      );
    })
    .join("\n");

  const registry =
    HEADER +
    `import type { ThemeRegistryEntry } from "./registry-types";\n` +
    (imports ? imports + "\n" : "") +
    `\nexport const GENERATED_THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {\n` +
    (entries ? entries + "\n" : "") +
    `};\n`;

  const clientEntries = included.filter(({ input }) => input.resolvable.themeClient);
  const clientRegistry =
    `"use client";\n` +
    HEADER +
    `import type { ThemeClientDefinition } from "@/contexts/themes/contracts/v8";\n\n` +
    `export const THEME_CLIENT_REGISTRY: Record<string, () => Promise<ThemeClientDefinition>> = {\n` +
    clientEntries
      .map(({ key, input }) => `  ${JSON.stringify(key)}: () => import("${input.dep}/theme-client").then((mod) => mod.default ?? mod),\n`)
      .join("") +
    `};\n`;

  // Além do @import dos tokens, um @source por tema: Tailwind v4 nunca escaneia node_modules.
  const cssImports =
    CSS_HEADER +
    included.map(({ input }) => `@import "${input.dep}/theme.css";\n@source "${input.sourceDir}";`).join("\n") +
    (included.length ? "\n" : "");

  // W9 (scripts/theme-lineage.ts, spec §3.1): CSS de cada ancestral reescrito pra
  // `:is([data-theme="pai"],[data-theme="filho"])`, raiz primeiro; avisos de dark incompleto.
  const lineage = buildThemeLineage(
    included.map(({ key, lineage: chain, input }) => ({ key, lineage: chain, css: input.themeCss })),
    options.slimeCss !== undefined ? { [RESERVED_KEY]: options.slimeCss } : {},
  );
  issues.push(...lineage.issues);
  const lineageCss = CSS_HEADER + lineage.css;
  // W1: valores light/dark parseados por tema efetivo (scripts/theme-tokens.ts), slime incluído.
  const tokensModule = buildThemeTokensModule(
    [
      ...(options.slimeCss !== undefined ? [{ key: RESERVED_KEY, css: options.slimeCss }] : []),
      ...included.flatMap(({ key, input }) => (input.themeCss !== undefined ? [{ key, css: input.themeCss }] : [])),
    ],
    Object.fromEntries(included.map(({ key, lineage }) => [key, lineage])),
  );

  const excluded = packages
    .map((input) => input.dep.slice("@venore/theme-".length))
    .filter((key) => !included.some((entry) => entry.key === key) && issues.some((issue) => issue.themeKey === key));

  return {
    registry,
    clientRegistry,
    cssImports,
    lineageCss,
    tokensModule,
    report: {
      generatedAt: (options.now ?? new Date()).toISOString(),
      strict: options.strict,
      themes: included.map(({ key, input, version, contract, lineage }) => ({
        key,
        packageName: input.dep,
        packageVersion: version,
        contract,
        lineage,
      })),
      excluded,
      issues,
    },
  };
}
