import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/settings", () => ({ getSetting: vi.fn(), setSetting: vi.fn() }));
vi.mock("@/contexts/themes", () => ({ getActiveColorPalette: vi.fn() }));
vi.mock("./resolve-active-theme", () => ({ resolveActiveTheme: vi.fn() }));

const { buildColorPaletteOverrideCss, buildPaletteCss, paletteFromChoice } = await import("./resolve-active-color-palette");

const preset = { id: "oceano", name: "Oceano", light: { primary: "oklch(0.5 0.2 245)", ring: "oklch(0.5 0.2 245)" }, dark: { primary: "oklch(0.7 0.2 245)" } };
const theme = { key: "aurora", colorPalettes: [preset] };

describe("buildPaletteCss (v8, W1)", () => {
  it("default = nenhum CSS; preset e custom saem byte a byte iguais ao buildColorPaletteOverrideCss", () => {
    expect(buildPaletteCss(theme, { mode: "default" })).toBe("");
    expect(buildPaletteCss(theme, undefined)).toBe("");
    expect(buildPaletteCss(theme, { mode: "preset", presetId: "oceano" })).toBe(buildColorPaletteOverrideCss("aurora", preset));
    const custom = { mode: "custom" as const, light: { primary: "#112233" }, dark: { background: "#000000" } };
    expect(buildPaletteCss(theme, custom)).toBe(
      'html[data-theme="aurora"] { --primary: #112233; }\nhtml[data-theme="aurora"].dark { --background: #000000; }',
    );
  });

  it("seed usa os tokens gerados, inclusive tier-3 de região", () => {
    const css = buildPaletteCss(theme, {
      mode: "seed",
      seed: "#3366cc",
      generated: { light: { primary: "#3366cc", "region-rail-background": "#1a1a2e" }, dark: {} },
    });
    expect(css).toBe('html[data-theme="aurora"] { --primary: #3366cc; --region-rail-background: #1a1a2e; }');
  });

  it("valor ou nome fora do whitelist é descartado (nada de injeção em <style>)", () => {
    const css = buildPaletteCss(theme, {
      mode: "custom",
      light: { primary: "red;}</style><script>", "x}y": "#ffffff", ring: "oklch(0.5 0.1 200 / 50%)" },
      dark: {},
    });
    expect(css).toBe('html[data-theme="aurora"] { --ring: oklch(0.5 0.1 200 / 50%); }');
  });

  it("preset inexistente = nenhum CSS", () => {
    expect(buildPaletteCss(theme, { mode: "preset", presetId: "nope" })).toBe("");
  });

  it("lockedTokens das regras do tema nunca saem (preset, custom e seed)", () => {
    const locked = { ...theme, palette: { lockedTokens: ["--ring", "background"] } };
    expect(buildPaletteCss(locked, { mode: "preset", presetId: "oceano" })).toBe(
      'html[data-theme="aurora"] { --primary: oklch(0.5 0.2 245); }\nhtml[data-theme="aurora"].dark { --primary: oklch(0.7 0.2 245); }',
    );
    expect(buildPaletteCss(locked, { mode: "custom", light: { background: "#ffffff", primary: "#000000" }, dark: {} })).toBe(
      'html[data-theme="aurora"] { --primary: #000000; }',
    );
    expect(paletteFromChoice([preset], { mode: "preset", presetId: "oceano" }, undefined)).toBe(preset);
  });

  describe("scope (galeria)", () => {
    const choice = { mode: "preset" as const, presetId: "oceano" };

    it("troca o <html> pelo seletor da raiz escopada, mantendo data-theme e a variante .dark", () => {
      expect(buildPaletteCss(theme, choice, { scope: "[data-gallery-root]" })).toBe(
        '[data-gallery-root][data-theme="aurora"] { --primary: oklch(0.5 0.2 245); --ring: oklch(0.5 0.2 245); }\n' +
          '[data-gallery-root][data-theme="aurora"].dark { --primary: oklch(0.7 0.2 245); }',
      );
    });

    it("o seletor escopado vence o do theme.css que também casa na raiz (especificidade)", () => {
      // [data-theme="k"] = (0,1,0) e .dark = (0,2,0); escopado = (0,2,0) e (0,3,0).
      const css = buildPaletteCss(theme, choice, { scope: "[data-gallery-root]" });
      const selectors = css.split("\n").map((rule) => rule.slice(0, rule.indexOf(" {")));
      const attributeOrClassCount = (selector: string) => (selector.match(/\[|\./g) ?? []).length;
      expect(attributeOrClassCount(selectors[0])).toBeGreaterThan(1);
      expect(attributeOrClassCount(selectors[1])).toBeGreaterThan(2);
    });

    it("escopo com caractere perigoso = nenhum CSS (nunca cai pro documento inteiro)", () => {
      expect(buildPaletteCss(theme, choice, { scope: "x{} html" })).toBe("");
      expect(buildPaletteCss(theme, choice, { scope: "</style>" })).toBe("");
      expect(buildPaletteCss(theme, choice, { scope: "" })).toBe("");
    });

    it("sem escolha de paleta, escopo também não emite nada", () => {
      expect(buildPaletteCss(theme, { mode: "default" }, { scope: "#g" })).toBe("");
    });
  });
});
