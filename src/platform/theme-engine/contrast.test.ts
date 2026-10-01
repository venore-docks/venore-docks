import { describe, expect, it } from "vitest";
import { checkRegionContrast, contrastRatio, contrastRatioColors, describeRegionContrastProblem } from "./contrast";
import { parseCssColor } from "./oklch-color";

describe("contrastRatio", () => {
  it("preto vs. branco = 21 (máximo)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("é simétrico (ordem dos argumentos não importa)", () => {
    expect(contrastRatio("#123456", "#abcdef")).toBeCloseTo(contrastRatio("#abcdef", "#123456"), 5);
  });

  it("cor igual = 1 (mínimo)", () => {
    expect(contrastRatio("#3366cc", "#3366cc")).toBeCloseTo(1, 5);
  });

  it("branco em quase-branco fica bem abaixo de 4.5", () => {
    expect(contrastRatio("#ffffff", "#fefefe")).toBeLessThan(1.1);
  });

  it("um par legível (texto escuro em fundo claro) passa de 4.5", () => {
    expect(contrastRatio("#1f2933", "#f5f7fa")).toBeGreaterThan(4.5);
  });
});

describe("contrastRatioColors (alpha)", () => {
  it("fundo translúcido é composto sobre o backdrop", () => {
    const black = parseCssColor("#000000")!;
    const white = parseCssColor("#ffffff")!;
    const halfBlack = parseCssColor("#00000080")!;
    expect(contrastRatioColors(black, white)).toBeCloseTo(21, 0);
    // preto 50% sobre branco ≈ cinza médio: bem abaixo de 21 contra preto
    expect(contrastRatioColors(black, halfBlack, white)).toBeLessThan(6);
    // mesmo fundo translúcido sobre backdrop preto = preto
    expect(contrastRatioColors(white, halfBlack, black)).toBeCloseTo(21, 0);
  });
});

describe("checkRegionContrast", () => {
  const good = {
    background: "#ffffff",
    foreground: "#111111",
    "muted-foreground": "#555555",
    ring: "#3366cc",
    accent: "#2f6f4f",
  };

  it("sem problema quando todos os pares passam nos dois modos", () => {
    expect(checkRegionContrast({ light: good, dark: good })).toEqual([]);
  });

  it("aponta região, modo, par, razão e mínimo (texto 4.5, não-texto 3)", () => {
    const problems = checkRegionContrast({
      light: { ...good, "region-rail-background": "#222222", "region-rail-foreground": "#333333" },
      dark: { ...good, accent: "#f0f0f0" },
    });
    expect(problems).toContainEqual(
      expect.objectContaining({ region: "rail", mode: "light", pair: "foreground/background", min: 4.5 }),
    );
    expect(problems.filter((problem) => problem.pair === "accent/background" && problem.mode === "dark")).toHaveLength(5);
    expect(problems.every((problem) => problem.ratio < problem.min)).toBe(true);
    expect(describeRegionContrastProblem(problems[0])).toMatch(/região "\w+"/);
  });

  it("minContrast da regra vale pros pares de texto daquela região", () => {
    const problems = checkRegionContrast(
      { light: { ...good, foreground: "#6b6b6b" }, dark: good },
      { regions: { footer: { tone: "inherit", minContrast: 7 } } },
    );
    expect(problems.map((problem) => problem.region)).toEqual(["footer"]);
  });

  it("surfaces: kit usa --sidebar-bg-start no rail; tokens não", () => {
    const tokens = { ...good, "sidebar-bg-start": "#151515" };
    expect(checkRegionContrast({ light: tokens, dark: good }, { only: ["rail"] }).length).toBeGreaterThan(0);
    expect(checkRegionContrast({ light: tokens, dark: good }, { only: ["rail"], surfaces: "tokens" })).toEqual([]);
  });

  it("resolve var() e color-mix() antes de medir", () => {
    const problems = checkRegionContrast({
      light: { ...good, "muted-foreground": "color-mix(in oklch, var(--foreground) 10%, var(--background))" },
      dark: good,
    });
    expect(problems.some((problem) => problem.pair === "muted-foreground/background")).toBe(true);
  });
});
