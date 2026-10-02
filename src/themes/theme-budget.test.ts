import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { DEFAULT_THEME_BUDGETS, MAX_THEME_BUDGETS } from "@/contexts/themes/contracts/v8";
import {
  checkThemeBudget,
  effectiveThemeBudgets,
  formatBudgetViolation,
  hasUseClientDirective,
  resolveBudgetTarget,
  themeCssFile,
  type ThemeBudgetReportEntry,
} from "../../scripts/lib/theme-check/theme-budget";
import { selectedThemeKeys } from "../../e2e-themes/ssr-output";
import { THEME_REGISTRY } from "./registry";

// Orçamento de performance por tema (spec v8 §7.12, job `check`): theme.css gz, CSS de linhagem gz,
// JS client (esbuild, minify, esm) gz e número de módulos "use client" de cada tema do registro,
// contra manifest.budgets limitado ao MAX (padrão calibrado em contracts/v8/budgets.ts). O
// resultado vai pra theme-report.generated.json (chave `budgets`, artefato do CI).
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REPORT_PATH = path.join(ROOT, "src/themes/theme-report.generated.json");
// VENORE_THEME_KEYS (scripts/theme-check.ts --theme) restringe a medição.
const keys = selectedThemeKeys(Object.keys(THEME_REGISTRY)).filter((key) => THEME_REGISTRY[key]);
const entries: ThemeBudgetReportEntry[] = [];

function targetFor(key: string) {
  const entry = THEME_REGISTRY[key];
  return resolveBudgetTarget(
    ROOT,
    {
      key,
      contract: entry.contract,
      packageName: entry.packageName,
      lineage: entry.contract === 8 ? entry.lineage : [key],
      declared: entry.manifest.budgets,
    },
    (themeKey) => themeCssFile(ROOT, themeKey, THEME_REGISTRY[themeKey]?.packageName ?? null),
  );
}

// Funde no relatório do codegen (só as chaves medidas nesta rodada são trocadas).
afterAll(() => {
  if (entries.length === 0 || !existsSync(REPORT_PATH)) return;
  const report = JSON.parse(readFileSync(REPORT_PATH, "utf8")) as { budgets?: { measuredAt?: string; themes?: ThemeBudgetReportEntry[] } } & Record<string, unknown>;
  const measured = new Set(entries.map((entry) => entry.key));
  const kept = (report.budgets?.themes ?? []).filter((entry) => !measured.has(entry.key) && THEME_REGISTRY[entry.key]);
  const themes = [...kept, ...entries].sort((a, b) => a.key.localeCompare(b.key));
  report.budgets = { measuredAt: new Date().toISOString(), themes };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
});

describe("orçamento de performance — todo tema do registro", () => {
  for (const key of keys) {
    it(`${key} cabe no orçamento`, async () => {
      const result = await checkThemeBudget(targetFor(key));
      entries.push(result);
      expect(result.measured.cssGzipBytes, `${key} sem theme.css medido`).toBeGreaterThan(0);
      expect(result.violations.map((violation) => formatBudgetViolation(key, violation))).toEqual([]);
    }, 30_000);
  }

  it("pacote 7.x mede a entrada '.', com os componentes client do Shell", async () => {
    const legacy = keys.find((key) => THEME_REGISTRY[key].contract === 7);
    if (!legacy) return;
    const target = targetFor(legacy);
    expect(target.entries.length).toBe(1);
    const result = await checkThemeBudget(target);
    expect(result.measured.clientModules).toBeGreaterThan(0);
    expect(result.measured.clientJsGzipBytes).toBeGreaterThan(0);
  }, 30_000);
});

describe("budget efetivo", () => {
  it("ausente = padrão; o manifesto pode baixar e subir até o MAX (2×), nunca além nem abaixo de 0", () => {
    expect(effectiveThemeBudgets(undefined)).toEqual(DEFAULT_THEME_BUDGETS);
    expect(effectiveThemeBudgets({ cssGzipBytes: 1_000 }).cssGzipBytes).toBe(1_000);
    expect(effectiveThemeBudgets({ cssGzipBytes: 10_000_000 }).cssGzipBytes).toBe(MAX_THEME_BUDGETS.cssGzipBytes);
    expect(effectiveThemeBudgets({ clientModules: -3 }).clientModules).toBe(0);
    expect(effectiveThemeBudgets({ clientJsGzipBytes: Number.NaN }).clientJsGzipBytes).toBe(DEFAULT_THEME_BUDGETS.clientJsGzipBytes);
    for (const metric of Object.keys(MAX_THEME_BUDGETS) as (keyof typeof MAX_THEME_BUDGETS)[]) {
      expect(MAX_THEME_BUDGETS[metric]).toBe(DEFAULT_THEME_BUDGETS[metric] * 2);
    }
  });

  it("reconhece a diretiva 'use client' depois de comentários, e só no topo", () => {
    expect(hasUseClientDirective('"use client";\nexport {}')).toBe(true);
    expect(hasUseClientDirective("// cabeçalho\n/* bloco */\n'use client'\n")).toBe(true);
    expect(hasUseClientDirective('import x from "y";\n"use client";')).toBe(false);
  });
});

// Fixture gerado: pacote 7.x com theme.css e JS client bem acima até do MAX, e um manifesto que
// tenta subir o orçamento além do teto — a medição precisa reprovar.
describe("fixture superdimensionado", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "venore-theme-budget-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  // Pseudoaleatório determinístico (gzip não comprime).
  let seed = 42;
  const noise = (length: number) => {
    let text = "";
    while (text.length < length) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      text += seed.toString(36);
    }
    return text.slice(0, length);
  };

  mkdirSync(path.join(dir, "components"), { recursive: true });
  writeFileSync(
    path.join(dir, "theme.css"),
    `[data-theme="oversized"] {\n${Array.from({ length: 1_200 }, (_, index) => `  --oversized-${index}: "${noise(24)}";`).join("\n")}\n}\n`,
  );
  const clientModule = (name: string) =>
    `"use client";\nimport { useState } from "react";\nexport function ${name}() { const [v] = useState(${JSON.stringify(noise(6_000))}); return v; }\n`;
  const names = Array.from({ length: 30 }, (_, index) => `Client${index}`);
  for (const name of names) writeFileSync(path.join(dir, "components", `${name}.tsx`), clientModule(name));
  writeFileSync(path.join(dir, "components", "server-only.ts"), `export const big = ${JSON.stringify(noise(50_000))};\n`);
  writeFileSync(
    path.join(dir, "index.ts"),
    names.map((name) => `export { ${name} } from "./components/${name}";`).join("\n") + `\nexport { big } from "./components/server-only";\n`,
  );

  it("reprova CSS, JS client e número de módulos — mesmo com o manifesto pedindo mais que o MAX", async () => {
    const result = await checkThemeBudget({
      key: "oversized",
      dir,
      entries: ["index.ts"],
      cssFile: path.join(dir, "theme.css"),
      ancestorCssFiles: [path.join(dir, "theme.css"), path.join(dir, "theme.css")],
      declared: { cssGzipBytes: 1e9, clientJsGzipBytes: 1e9, clientModules: 1e9, lineageCssGzipBytes: 1e9 },
    });
    expect(result.budgets).toEqual(MAX_THEME_BUDGETS);
    expect(result.measured.clientModules).toBe(30); // o módulo sem "use client" não conta
    expect(result.violations.map((violation) => violation.metric).sort()).toEqual([
      "clientJsGzipBytes",
      "clientModules",
      "cssGzipBytes",
      "lineageCssGzipBytes",
    ]);
  }, 30_000);
});
