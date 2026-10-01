import { describe, expect, it } from "vitest";
import { getThemeTokenValues } from "../token-values";
import { contrastRatioColors, MIN_TEXT_CONTRAST } from "../contrast";
import { hexToOklch, parseCssColor } from "../oklch-color";
import { buildFullPaletteFromSeed } from "../full-palette-generator";
import { generateThemePalette } from "./generate-theme-palette";
import golden from "./__golden__/legacy-generators.golden.json";

const slime = getThemeTokenValues("venore-slime");
const lightness = (hex: string) => parseCssColor(hex)!.l;
const ratio = (fg: string, bg: string) => contrastRatioColors(parseCssColor(fg)!, parseCssColor(bg)!);

describe("generateThemePalette", () => {
  it("sem regras nem base = buildFullPaletteFromSeed (golden)", () => {
    for (const [hex, expected] of Object.entries(golden.fullFromHex)) {
      const { light, dark } = generateThemePalette({ seed: hex, rules: {}, base: null });
      expect({ light, dark }).toEqual(expected);
    }
  });

  // Critério de aceite W1: rail:dark → fundo L ≤ 0.28 e contraste ≥ 4.5 nos dois modos.
  for (const seed of ["#facc15", "#ffffff", "#0f766e", "#e11d48", "#000000", "#22d3ee"]) {
    it(`regions.rail = dark mantém o rail escuro e legível (semente ${seed})`, () => {
      const result = generateThemePalette({ seed, rules: { regions: { rail: { tone: "dark" } } }, base: slime });
      for (const mode of [result.light, result.dark]) {
        const bg = mode["region-rail-background"];
        const fg = mode["region-rail-foreground"];
        expect(lightness(bg)).toBeLessThanOrEqual(0.28);
        expect(lightness(fg)).toBeGreaterThanOrEqual(0.92);
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(mode["region-rail-muted-foreground"], bg)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(mode["region-rail-ring"], bg)).toBeGreaterThanOrEqual(3);
        expect(ratio(mode["region-rail-accent"], bg)).toBeGreaterThanOrEqual(3);
        expect(ratio(mode["region-rail-primary-foreground"], mode["region-rail-primary"])).toBeGreaterThanOrEqual(4.5);
        // a superfície que o kit pinta acompanha o tom
        expect(mode["sidebar-bg-start"]).toBe(bg);
        expect(lightness(mode["sidebar-bg-end"])).toBeLessThanOrEqual(0.28);
      }
      expect(result.problems.filter((problem) => problem.region === "rail")).toEqual([]);
    });
  }

  it("regions.header = light é claro nos dois modos (inclusive no escuro)", () => {
    const { light, dark } = generateThemePalette({ seed: "#3366cc", rules: { regions: { header: { tone: "light" } } }, base: slime });
    for (const mode of [light, dark]) {
      expect(lightness(mode["region-header-background"])).toBeGreaterThanOrEqual(0.94);
      expect(ratio(mode["region-header-foreground"], mode["region-header-background"])).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(mode["header-bg"]).toBe(mode["region-header-background"]);
    }
  });

  it("regions.footer = brand usa o primary como fundo, com texto calculado", () => {
    const { light, dark, problems } = generateThemePalette({
      seed: "#7c3aed",
      rules: { regions: { footer: { tone: "brand" } } },
      base: slime,
    });
    expect(light["region-footer-background"]).toBe(light.primary);
    expect(dark["region-footer-background"]).toBe(dark.primary);
    for (const mode of [light, dark]) {
      expect(ratio(mode["region-footer-foreground"], mode["region-footer-background"])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(mode["region-footer-muted-foreground"], mode["region-footer-background"])).toBeGreaterThanOrEqual(4.5);
    }
    expect(problems.filter((problem) => problem.region === "footer")).toEqual([]);
  });

  it("minContrast da regra é honrado pelo tom", () => {
    const { light } = generateThemePalette({
      seed: "#3366cc",
      rules: { regions: { contextual: { tone: "light", minContrast: 7 } } },
      base: slime,
    });
    expect(ratio(light["region-contextual-muted-foreground"], light["region-contextual-background"])).toBeGreaterThanOrEqual(7);
  });

  it("inherit não emite tier-3 (o default de region-tokens.css já copia o tier-2)", () => {
    const { light } = generateThemePalette({ seed: "#3366cc", rules: { regions: { rail: { tone: "inherit" } } }, base: slime });
    expect(Object.keys(light).some((token) => token.startsWith("region-"))).toBe(false);
  });

  it("sem semente: aplica só os tons de região sobre a base do tema", () => {
    const { light, dark } = generateThemePalette({ seed: null, rules: { regions: { rail: { tone: "dark" } } }, base: slime });
    expect(light.primary).toBeUndefined();
    expect(lightness(light["region-rail-background"])).toBeLessThanOrEqual(0.28);
    expect(lightness(dark["region-rail-background"])).toBeLessThanOrEqual(0.28);
  });

  it("lockedTokens não saem no override (com ou sem `--`)", () => {
    const { light, dark } = generateThemePalette({
      seed: "#3366cc",
      rules: { lockedTokens: ["--background", "sidebar-bg-start"] },
      base: slime,
    });
    expect(light.background).toBeUndefined();
    expect(dark["sidebar-bg-start"]).toBeUndefined();
    expect(light.primary).toBe("#3366cc");
  });

  it("estratégias de accent", () => {
    const seed = hexToOklch("#3366cc");
    const hueOf = (accent: "complement" | "analogous" | "same" | "neutral") =>
      parseCssColor(generateThemePalette({ seed, rules: { accent } }).light.accent!)!;
    expect(generateThemePalette({ seed, rules: { accent: "complement" } }).light).toEqual(buildFullPaletteFromSeed(seed).light);
    expect(Math.abs(hueOf("analogous").h - ((seed.h + 30) % 360))).toBeLessThan(6);
    expect(Math.abs(hueOf("same").h - seed.h)).toBeLessThan(6);
    expect(hueOf("neutral").c).toBeLessThan(hueOf("same").c / 4);
  });

  it("problems lista o contraste por região do resultado efetivo (base + paleta)", () => {
    const { problems } = generateThemePalette({ seed: "#ffffff", rules: {}, base: slime });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatchObject({ region: expect.any(String), mode: expect.any(String), pair: expect.any(String) });
  });

  it("semente inválida = sem tokens de semente", () => {
    expect(generateThemePalette({ seed: "not-a-color", rules: {} })).toMatchObject({ light: {}, dark: {} });
  });
});
