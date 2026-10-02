#!/usr/bin/env tsx
// Gate completo de um tema (spec v8 §10) — o mesmo do job `themes` do CI, rodável num checkout do
// core com o pacote do tema instalado (é o que o workflow reutilizável
// .github/workflows/theme-check.yml faz no repositório do tema, antes de criar a tag).
//
//   npx tsx scripts/theme-check.ts                       # todo tema do registro
//   npx tsx scripts/theme-check.ts --theme aurora        # só o tema (+ o fallback venore-slime)
//   npx tsx scripts/theme-check.ts --theme aurora --no-browser   # sem Playwright
//
// Passos (todos rodam; o código de saída é ≠ 0 se qualquer um falhar):
//   1. codegen estrito do registro (manifesto × package.json, extends, chaves);
//   2. vitest: invariantes do registro, contrato de tokens, contraste por região (baseline),
//      orçamento de performance e o harness SSR (landmarks, navs rotuladas, JSON-LD, outlets,
//      skip link) — que grava o HTML + CSS compilado em test-results/themes-ssr/;
//   3. Playwright (setContent, 390×844 e 1280×800, claro/escuro): overflow, teclado, axe;
//   4. resumo: orçamento medido × limite por tema e a dívida de a11y encontrada.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const FALLBACK = "venore-slime";

type Options = { themes: string[]; browser: boolean };

function parseArgs(argv: string[]): Options {
  const options: Options = { themes: [], browser: true };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--theme" || arg === "-t") options.themes.push(...(argv[++index] ?? "").split(","));
    else if (arg.startsWith("--theme=")) options.themes.push(...arg.slice("--theme=".length).split(","));
    else if (arg === "--no-browser") options.browser = false;
    else if (arg === "--help" || arg === "-h") {
      console.log("uso: tsx scripts/theme-check.ts [--theme <chave>[,<chave>]] [--no-browser]");
      process.exit(0);
    } else {
      console.error(`argumento desconhecido: ${arg}`);
      process.exit(2);
    }
  }
  options.themes = [...new Set(options.themes.map((key) => key.trim()).filter(Boolean))];
  if (options.themes.length > 0 && !options.themes.includes(FALLBACK)) options.themes.push(FALLBACK);
  return options;
}

type Step = { name: string; ok: boolean };

function run(name: string, command: string, args: string[], env: NodeJS.ProcessEnv): Step {
  console.log(`\n▶ ${name}\n  $ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: ROOT, env, stdio: "inherit", shell: process.platform === "win32" });
  const ok = result.status === 0;
  console.log(ok ? `✔ ${name}` : `✘ ${name} (código ${result.status ?? result.signal})`);
  return { name, ok };
}

type BudgetEntry = {
  key: string;
  measured: Record<string, number>;
  budgets: Record<string, number>;
  violations: { metric: string; measured: number; budget: number }[];
};

function printBudgets(themes: string[]) {
  const reportPath = path.join(ROOT, "src/themes/theme-report.generated.json");
  if (!existsSync(reportPath)) return;
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as { budgets?: { themes: BudgetEntry[] } };
  const entries = (report.budgets?.themes ?? []).filter((entry) => themes.length === 0 || themes.includes(entry.key));
  if (entries.length === 0) return;
  console.log("\nOrçamento (bytes gzip; medido / limite):");
  for (const entry of entries) {
    const cell = (metric: string) => `${entry.measured[metric]}/${entry.budgets[metric]}`;
    const flag = entry.violations.length > 0 ? "  ✘" : "";
    console.log(
      `  ${entry.key.padEnd(16)} css ${cell("cssGzipBytes").padEnd(12)} linhagem ${cell("lineageCssGzipBytes").padEnd(12)} js ${cell("clientJsGzipBytes").padEnd(12)} módulos ${cell("clientModules")}${flag}`,
    );
  }
}

function printA11y(themes: string[]) {
  const summaryPath = path.join(ROOT, "test-results/themes-a11y/summary.json");
  if (!existsSync(summaryPath)) return;
  const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as { pages: number; issues: Record<string, Record<string, string[]>> };
  console.log(`\nA11y no navegador: ${summary.pages} página(s).`);
  for (const [theme, pages] of Object.entries(summary.issues)) {
    if (themes.length > 0 && !themes.includes(theme)) continue;
    const distinct = [...new Set(Object.values(pages).flat())].sort();
    if (distinct.length > 0) console.log(`  ${theme}: ${distinct.join(", ")} (dívida comparada com e2e-themes/a11y-baseline.json)`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (options.themes.length > 0) env.VENORE_THEME_KEYS = options.themes.join(",");

  const steps: Step[] = [];
  steps.push(run("codegen estrito do registro de temas", "npx", ["tsx", "scripts/gen-theme-registry.ts", "--strict"], env));
  steps.push(
    run(
      "registro, tokens, contraste, orçamento e harness SSR",
      "npx",
      [
        "vitest",
        "run",
        "--config",
        "vitest.themes.config.ts",
        "src/themes/registry.test.ts",
        "src/themes/theme-token-contract",
        "src/themes/theme-contrast.test.ts",
        "src/themes/theme-budget.test.ts",
        "src/themes/theme-ssr.harness.test.tsx",
      ],
      env,
    ),
  );
  if (options.browser) {
    steps.push(run("Playwright (overflow, teclado, axe; screenshots)", "npx", ["playwright", "test", "--config", "playwright.themes.config.ts"], env));
  }

  printBudgets(options.themes);
  printA11y(options.themes);
  console.log("\nArtefatos: test-results/themes-ssr/ (HTML), test-results/themes-screenshots/, src/themes/theme-report.generated.json");

  const failed = steps.filter((step) => !step.ok);
  console.log(failed.length === 0 ? "\n✔ theme-check passou." : `\n✘ theme-check falhou: ${failed.map((step) => step.name).join("; ")}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
