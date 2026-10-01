import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkRegionContrast, type RegionContrastProblem } from "@/platform/theme-engine/contrast";
import { THEME_REGISTRY } from "./registry";
import { THEME_TOKEN_VALUES } from "./theme-tokens.generated";
import baseline from "./a11y-baseline.json";

// Contraste por região de todo tema do registro (spec v8 §7.14 / §10): fg/bg e muted-fg/bg ≥ 4.5
// (ou o minContrast da regra do tema), ring/bg e accent/bg ≥ 3, nas 5 regiões, light e dark. Os
// valores vêm do theme.css parseado pelo codegen (theme-tokens.generated.ts), com a paleta padrão.
//
// Dívida existente fica em a11y-baseline.json ("tema": ["região/modo/par", …]) — catraca nos dois
// sentidos: problema novo falha, e problema resolvido também (pra baseline só encolher). Depois de
// melhorar um tema de propósito: UPDATE_A11Y_BASELINE=1 npx vitest run src/themes/theme-contrast.test.ts
const BASELINE_PATH = fileURLToPath(new URL("./a11y-baseline.json", import.meta.url));
const recorded = baseline as Record<string, string[]>;

const problemKey = (problem: RegionContrastProblem) => `${problem.region}/${problem.mode}/${problem.pair}`;

function problemsOf(themeKey: string): string[] {
  const values = THEME_TOKEN_VALUES[themeKey];
  const rules = THEME_REGISTRY[themeKey].manifest.palette;
  return checkRegionContrast(values, { regions: rules?.regions }).map(problemKey).sort();
}

const themeKeys = Object.keys(THEME_REGISTRY).sort();

if (process.env.UPDATE_A11Y_BASELINE === "1") {
  const next = Object.fromEntries(themeKeys.map((key) => [key, problemsOf(key)]).filter(([, list]) => list.length > 0));
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
}

describe("contraste por região — todo tema do registro", () => {
  it("todo tema do registro tem tokens parseados (codegen rodou)", () => {
    expect(themeKeys.length).toBeGreaterThanOrEqual(1);
    expect(themeKeys.filter((key) => !THEME_TOKEN_VALUES[key])).toEqual([]);
  });

  it("baseline só cita temas do registro", () => {
    expect(Object.keys(recorded).filter((key) => !THEME_REGISTRY[key])).toEqual([]);
  });

  for (const key of themeKeys) {
    it(`${key}: nenhum problema novo; nenhum problema resolvido esquecido no baseline`, () => {
      if (!THEME_TOKEN_VALUES[key]) return; // coberto pelo teste acima
      const current = problemsOf(key);
      const allowed = new Set(recorded[key] ?? []);
      const fresh = current.filter((problem) => !allowed.has(problem));
      const fixed = [...allowed].filter((problem) => !current.includes(problem));
      expect(fresh, `contraste novo abaixo do mínimo em ${key}`).toEqual([]);
      expect(fixed, `${key} melhorou: rode UPDATE_A11Y_BASELINE=1 pra encolher o baseline`).toEqual([]);
    });
  }

  it("o fallback (venore-slime) não tem dívida de texto (fg/bg e muted-fg/bg)", () => {
    expect(problemsOf("venore-slime").filter((problem) => /\/(muted-)?foreground\/background$/.test(problem))).toEqual([]);
  });
});
