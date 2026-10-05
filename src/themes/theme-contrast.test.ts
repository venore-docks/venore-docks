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
// sentidos: problema novo falha, e problema resolvido também (pra baseline só encolher; com
// VENORE_THEME_KEYS — theme-check de um repositório de tema — resolvido só avisa). Depois de
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
  // Entradas de pacotes ausentes neste branch ficam como estão (a catraca delas vale onde o pacote
  // está instalado); só os temas do registro são regravados.
  const merged: Record<string, string[]> = { ...recorded };
  for (const key of themeKeys) {
    const list = problemsOf(key);
    if (list.length > 0) merged[key] = list;
    else delete merged[key];
  }
  const next = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
}

describe("contraste por região — todo tema do registro", () => {
  it("todo tema do registro tem tokens parseados (codegen rodou)", () => {
    expect(themeKeys.length).toBeGreaterThanOrEqual(1);
    expect(themeKeys.filter((key) => !THEME_TOKEN_VALUES[key])).toEqual([]);
  });

  // O baseline é compartilhado entre branches de instância com conjuntos diferentes de pacotes:
  // entrada de tema ausente do registro é ignorada (não falha); a catraca vale para os presentes.
  it("baseline bem-formado (região/modo/par), mesmo para temas ausentes do registro", () => {
    for (const [key, list] of Object.entries(recorded)) {
      for (const entry of list) expect(entry, key).toMatch(/^[a-z-]+\/(light|dark)\/[a-z-]+\/[a-z-]+$/);
    }
  });

  for (const key of themeKeys) {
    it(`${key}: nenhum problema novo; nenhum problema resolvido esquecido no baseline`, () => {
      if (!THEME_TOKEN_VALUES[key]) return; // coberto pelo teste acima
      const current = problemsOf(key);
      const allowed = new Set(recorded[key] ?? []);
      const fresh = current.filter((problem) => !allowed.has(problem));
      const fixed = [...allowed].filter((problem) => !current.includes(problem));
      expect(fresh, `contraste novo abaixo do mínimo em ${key}`).toEqual([]);
      // Dívida resolvida só reprova no CI do core (baseline sempre justo); no theme-check de um
      // repositório de tema (VENORE_THEME_KEYS) uma versão melhor do pacote não pode reprovar.
      if (process.env.VENORE_THEME_KEYS) {
        if (fixed.length > 0) console.warn(`${key}: contraste melhorou (encolher a11y-baseline.json): ${fixed.join(", ")}`);
      } else {
        expect(fixed, `${key} melhorou: rode UPDATE_A11Y_BASELINE=1 pra encolher o baseline`).toEqual([]);
      }
    });
  }

  it("o fallback (venore-slime) não tem dívida de texto (fg/bg e muted-fg/bg)", () => {
    expect(problemsOf("venore-slime").filter((problem) => /\/(muted-)?foreground\/background$/.test(problem))).toEqual([]);
  });
});
