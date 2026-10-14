import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { DEFAULT_THEME_BUDGETS, MAX_THEME_BUDGETS, type ThemeBudgets } from "../../../src/contexts/themes/contracts/v8/budgets";

// Orçamento de performance por tema (spec v8 §2.9 / §7.12). Mede, por tema:
//   - gzip do theme.css do pacote e do CSS de linhagem (o theme.css dos ancestrais, que a
//     herança W9 carrega antes do filho);
//   - um bundle esbuild (minify, esm) de TODO módulo "use client" alcançável a partir das entradas
//     do pacote ("." no 7.x; "./theme" e "./theme-client" no v8), com react*, next*, lucide-react e
//     o SDK de tema como externos — gzip do resultado e número de módulos client.
// Compara com `manifest.budgets` limitado a [0, MAX] (padrão quando ausente/inválido). Usado pelo
// teste do `check` (src/themes/theme-budget.test.ts) e por scripts/theme-check.ts.

export type ThemeBudgetMetric = keyof ThemeBudgets;
export const THEME_BUDGET_METRICS: readonly ThemeBudgetMetric[] = ["cssGzipBytes", "lineageCssGzipBytes", "clientJsGzipBytes", "clientModules"];

export type ThemeBudgetTarget = {
  key: string;
  // Diretório do pacote (ou de src/themes/venore-slime) — realpath.
  dir: string;
  // Entradas JS/TS relativas a `dir`.
  entries: string[];
  cssFile: string | null;
  ancestorCssFiles: string[];
  declared: Partial<ThemeBudgets> | undefined;
};

export type ThemeBudgetMeasurement = ThemeBudgets & { clientModuleFiles: string[] };

export type ThemeBudgetViolation = { metric: ThemeBudgetMetric; measured: number; budget: number };

export type ThemeBudgetReportEntry = {
  key: string;
  measured: ThemeBudgetMeasurement;
  budgets: ThemeBudgets;
  violations: ThemeBudgetViolation[];
};

// Budget efetivo: o declarado pelo manifesto, limitado a [0, MAX]; ausente ou inválido = padrão.
export function effectiveThemeBudgets(declared: Partial<ThemeBudgets> | undefined): ThemeBudgets {
  const result = { ...DEFAULT_THEME_BUDGETS };
  for (const metric of THEME_BUDGET_METRICS) {
    const value = declared?.[metric];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    result[metric] = Math.min(Math.max(0, Math.floor(value)), MAX_THEME_BUDGETS[metric]);
  }
  return result;
}

export function evaluateThemeBudget(measured: ThemeBudgets, budgets: ThemeBudgets): ThemeBudgetViolation[] {
  return THEME_BUDGET_METRICS.filter((metric) => measured[metric] > budgets[metric]).map((metric) => ({
    metric,
    measured: measured[metric],
    budget: budgets[metric],
  }));
}

const EXTERNAL_PATTERNS = [/^react(?:-dom)?(?:\/|$)/, /^next(?:\/|$)/, /^lucide-react(?:\/|$)/, /^@venore\/theme-sdk(?:\/|$)/, /^@\/theme-sdk(?:\/|$)/];

// Externos por padrão de especificador (o `external` do esbuild não aceita regex).
const externals: Plugin = {
  name: "venore-theme-externals",
  setup(context) {
    context.onResolve({ filter: /.*/ }, (args) =>
      EXTERNAL_PATTERNS.some((pattern) => pattern.test(args.path)) ? { path: args.path, external: true } : undefined,
    );
  },
};

const LOADERS = { ".css": "empty", ".png": "empty", ".jpg": "empty", ".svg": "empty", ".webp": "empty", ".woff2": "empty" } as const;

// Diretiva "use client" no topo do módulo (depois de comentários).
export function hasUseClientDirective(source: string): boolean {
  const withoutComments = source.replace(/^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*/, "");
  return /^["']use client["']/.test(withoutComments);
}

async function reachableModules(dir: string, entries: string[]): Promise<string[]> {
  if (entries.length === 0) return [];
  const result = await build({
    entryPoints: entries.map((entry) => path.join(dir, entry)),
    absWorkingDir: dir,
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "neutral",
    outdir: path.join(dir, ".theme-budget-out"),
    jsx: "automatic",
    loader: LOADERS,
    plugins: [externals],
    logLevel: "silent",
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs"],
    mainFields: ["module", "main"],
  });
  return Object.keys(result.metafile.inputs)
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    .map((file) => path.resolve(dir, file));
}

async function bundleClientModules(dir: string, files: string[]): Promise<Uint8Array> {
  // Namespace import de cada módulo: nada é eliminado por tree-shaking (o client recebe o módulo
  // inteiro como referência de client component) e dependências compartilhadas contam uma vez.
  const contents =
    files.map((file, index) => `import * as m${index} from ${JSON.stringify(file)};`).join("\n") +
    `\nexport { ${files.map((_, index) => `m${index}`).join(", ")} };\n`;
  const result = await build({
    stdin: { contents, resolveDir: dir, loader: "ts", sourcefile: "theme-client-entry.ts" },
    bundle: true,
    minify: true,
    write: false,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    loader: LOADERS,
    plugins: [externals],
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  return result.outputFiles[0]?.contents ?? new Uint8Array();
}

function gzipBytes(contents: string | Uint8Array): number {
  return contents.length === 0 ? 0 : gzipSync(contents).length;
}

export async function measureThemeBudget(target: ThemeBudgetTarget): Promise<ThemeBudgetMeasurement> {
  const css = target.cssFile && existsSync(target.cssFile) ? readFileSync(target.cssFile) : "";
  const lineage = target.ancestorCssFiles.filter((file) => existsSync(file)).map((file) => readFileSync(file, "utf8"));
  const modules = await reachableModules(target.dir, target.entries);
  const clientModuleFiles = modules.filter((file) => hasUseClientDirective(readFileSync(file, "utf8"))).sort();
  const bundle = clientModuleFiles.length > 0 ? await bundleClientModules(target.dir, clientModuleFiles) : new Uint8Array();
  return {
    cssGzipBytes: gzipBytes(css),
    lineageCssGzipBytes: gzipBytes(lineage.join("\n")),
    clientJsGzipBytes: gzipBytes(bundle),
    clientModules: clientModuleFiles.length,
    clientModuleFiles: clientModuleFiles.map((file) => path.relative(target.dir, file)),
  };
}

export async function checkThemeBudget(target: ThemeBudgetTarget): Promise<ThemeBudgetReportEntry> {
  const measured = await measureThemeBudget(target);
  const budgets = effectiveThemeBudgets(target.declared);
  return { key: target.key, measured, budgets, violations: evaluateThemeBudget(measured, budgets) };
}

// --- alvos a partir do registro ---------------------------------------------------------------

type PackageJson = { exports?: Record<string, unknown> | string };

function exportTarget(pkg: PackageJson, subpath: string): string | null {
  const exports = pkg.exports;
  if (typeof exports === "string") return subpath === "." ? exports : null;
  const value = exports?.[subpath];
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const conditional = value as Record<string, unknown>;
    for (const condition of ["import", "default", "require"]) {
      if (typeof conditional[condition] === "string") return conditional[condition] as string;
    }
  }
  return null;
}

export type RegistryBudgetInput = {
  key: string;
  contract: 7 | 8;
  packageName: string | null;
  lineage: readonly string[];
  declared: Partial<ThemeBudgets> | undefined;
};

// Diretório, entradas e CSS de um tema do registro. venore-slime mora em src/themes (sem pacote).
export function resolveBudgetTarget(root: string, input: RegistryBudgetInput, cssFileOf: (key: string) => string | null): ThemeBudgetTarget {
  if (!input.packageName) {
    const dir = realpathSync(path.join(root, "src/themes", input.key));
    const entry = ["theme.ts", "theme.tsx", "index.ts"].find((file) => existsSync(path.join(dir, file)));
    return {
      key: input.key,
      dir,
      entries: entry ? [entry] : [],
      cssFile: cssFileOf(input.key),
      ancestorCssFiles: input.lineage.slice(1).map(cssFileOf).filter((file): file is string => file !== null),
      declared: input.declared,
    };
  }
  const dir = realpathSync(path.join(root, "node_modules", input.packageName));
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as PackageJson;
  const subpaths = input.contract === 8 ? ["./theme", "./theme-client"] : ["."];
  const entries = subpaths
    .map((subpath) => exportTarget(pkg, subpath))
    .filter((entry): entry is string => entry !== null && /\.[cm]?[jt]sx?$/.test(entry));
  return {
    key: input.key,
    dir,
    entries,
    cssFile: cssFileOf(input.key),
    ancestorCssFiles: input.lineage.slice(1).map(cssFileOf).filter((file): file is string => file !== null),
    declared: input.declared,
  };
}

// theme.css de cada tema: o export "./theme.css" do pacote (ou theme.css na raiz); slime em src/.
export function themeCssFile(root: string, key: string, packageName: string | null): string | null {
  if (!packageName) {
    const file = path.join(root, "src/themes", key, "theme.css");
    return existsSync(file) ? file : null;
  }
  const dir = path.join(root, "node_modules", packageName);
  if (!existsSync(dir)) return null;
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as PackageJson;
  const target = exportTarget(pkg, "./theme.css") ?? "./theme.css";
  const file = path.join(realpathSync(dir), target);
  return existsSync(file) ? file : null;
}

export function formatBudgetViolation(key: string, violation: ThemeBudgetViolation): string {
  return `${key}: ${violation.metric} = ${violation.measured} > orçamento ${violation.budget}`;
}
