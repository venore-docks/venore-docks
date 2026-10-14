import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { A11Y_BASELINE_PATH, readBaseline, ROOT, type A11yBaseline } from "./pages";
import { A11Y_RESULTS_DIR } from "./ssr-output";

type PageResult = { theme: string; pageId: string; issues: string[] };

// Cada teste grava o resultado da página em test-results/themes-a11y/. Com
// UPDATE_THEME_A11Y_BASELINE=1 o baseline é reescrito a partir deles (só os temas que rodaram —
// VENORE_THEME_KEYS não apaga a dívida dos outros). Sempre grava um resumo pro artefato do CI.
export default function globalTeardown() {
  const dir = path.join(ROOT, A11Y_RESULTS_DIR);
  const results: PageResult[] = readdirSync(dir)
    .filter((file) => file.endsWith(".json") && file !== "summary.json")
    .map((file) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as PageResult);

  const byTheme: A11yBaseline = {};
  for (const result of results) {
    byTheme[result.theme] ??= {};
    if (result.issues.length > 0) byTheme[result.theme][result.pageId] = [...result.issues].sort();
  }
  writeFileSync(path.join(dir, "summary.json"), JSON.stringify({ pages: results.length, issues: byTheme }, null, 2));

  if (process.env.UPDATE_THEME_A11Y_BASELINE !== "1" || results.length === 0) return;
  const next: A11yBaseline = { ...readBaseline() };
  for (const theme of new Set(results.map((result) => result.theme))) {
    const pages = byTheme[theme] ?? {};
    if (Object.keys(pages).length === 0) delete next[theme];
    else next[theme] = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
  }
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(A11Y_BASELINE_PATH, JSON.stringify(sorted, null, 2) + "\n");
}
