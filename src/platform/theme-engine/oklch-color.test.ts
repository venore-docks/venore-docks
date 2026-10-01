import { describe, expect, it } from "vitest";
import { THEME_COLOR_VALUE_PATTERN } from "@/contexts/themes/contracts/v8";
import { formatOklch, hexToOklch, isValidHexColor, mixOklch, oklchToHex, parseCssColor, parseOklchNumeric } from "./oklch-color";

// Valores de referência conhecidos (mesmos usados por culori/colorjs.io) — tolerância larga
// porque implementações diferentes arredondam as constantes da matriz OKLab de formas ligeiramente
// distintas; o objetivo é pegar erro grosseiro de implementação, não bater casa decimal.
describe("hexToOklch", () => {
  it.each([
    ["#ff0000", 29.2],
    ["#00ff00", 142.5],
    ["#0000ff", 264.1],
    ["#ffff00", 110.0],
  ])("extrai o matiz de %s ≈ %s°", (hex, expectedHue) => {
    const { h } = hexToOklch(hex);
    expect(h).toBeGreaterThan(expectedHue - 5);
    expect(h).toBeLessThan(expectedHue + 5);
  });

  it("cinza puro tem chroma ≈ 0 (matiz indefinido, mas não lança)", () => {
    const { c, h } = hexToOklch("#808080");
    expect(c).toBeLessThan(0.01);
    expect(Number.isFinite(h)).toBe(true);
  });
});

describe("oklchToHex", () => {
  it("round-trip hex -> oklch -> hex fica próximo do original", () => {
    const original = "#3366cc";
    const { l, c, h } = hexToOklch(original);
    const roundTripped = oklchToHex(l, c, h);

    const originalBytes = [1, 3, 5].map((i) => Number.parseInt(original.slice(i, i + 2), 16));
    const roundTrippedBytes = [1, 3, 5].map((i) => Number.parseInt(roundTripped.slice(i, i + 2), 16));
    originalBytes.forEach((byte, index) => {
      expect(Math.abs(byte - roundTrippedBytes[index])).toBeLessThanOrEqual(2);
    });
  });

  it("clampa chroma fora do gamut sRGB sem produzir NaN/hex inválido", () => {
    const hex = oklchToHex(0.6, 0.4, 275);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("reproduz um tom plausível a partir de um valor real do Aurora (primary)", () => {
    // venore-theme-aurora/color-palettes.ts: primary base "oklch(0.53 0.21 275)" (índigo-violeta)
    const hex = oklchToHex(0.53, 0.21, 275);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    const { h } = hexToOklch(hex);
    expect(h).toBeGreaterThan(260);
    expect(h).toBeLessThan(290);
  });
});

describe("isValidHexColor", () => {
  it.each(["#ffffff", "#000000", "#3366cc"])("aceita %s", (hex) => {
    expect(isValidHexColor(hex)).toBe(true);
  });

  it.each(["roxo", "#fff", "3366cc", "#gggggg", ""])("rejeita %s", (hex) => {
    expect(isValidHexColor(hex)).toBe(false);
  });
});

describe("parseOklchNumeric", () => {
  it("lê L/C/H de uma string oklch(...)", () => {
    expect(parseOklchNumeric("oklch(0.53 0.21 275)")).toEqual({ l: 0.53, c: 0.21, h: 275 });
  });

  it("devolve null pra formato inesperado", () => {
    expect(parseOklchNumeric("#3366cc")).toBeNull();
  });
});

describe("parseCssColor (v8: alpha, %, none, hex curto/8, rgb)", () => {
  it("oklch com alpha numérico e percentual", () => {
    expect(parseCssColor("oklch(0.5 0.1 200 / 0.4)")).toMatchObject({ l: 0.5, c: 0.1, h: 200, alpha: 0.4 });
    expect(parseCssColor("oklch(0.5 0.1 200 / 40%)")).toMatchObject({ alpha: 0.4 });
  });

  it("L em % (100% = 1), C em % (100% = 0.4) e hue em deg", () => {
    const color = parseCssColor("oklch(62% 25% 158deg)")!;
    expect(color.l).toBeCloseTo(0.62, 6);
    expect(color.c).toBeCloseTo(0.1, 6);
    expect(color.h).toBe(158);
  });

  it("hue `none` e chroma 0 marcam hue ausente (powerless)", () => {
    expect(parseCssColor("oklch(0.4 0.02 none)")).toMatchObject({ hueMissing: true, h: 0 });
    expect(parseCssColor("oklch(1 0 0)")).toMatchObject({ hueMissing: true });
    expect(parseCssColor("oklch(0.6 0.1 120)")).toMatchObject({ hueMissing: false });
  });

  it("hex #rgb, #rgba, #rrggbbaa e nomes básicos", () => {
    expect(parseCssColor("#fff")).toMatchObject({ l: expect.closeTo(1, 3), alpha: 1 });
    expect(parseCssColor("#0000")).toMatchObject({ alpha: 0 });
    expect(parseCssColor("#00000080")!.alpha).toBeCloseTo(128 / 255, 6);
    expect(parseCssColor("white")).toMatchObject({ l: expect.closeTo(1, 3) });
    expect(parseCssColor("transparent")).toMatchObject({ alpha: 0, hueMissing: true });
  });

  it("rgb() moderno e legado", () => {
    expect(parseCssColor("rgb(255 255 255 / 0.5)")).toMatchObject({ l: expect.closeTo(1, 3), alpha: 0.5 });
    expect(parseCssColor("rgba(0, 0, 0, 0.25)")).toMatchObject({ l: expect.closeTo(0, 3), alpha: 0.25 });
  });

  it("recusa o que não é cor literal (var, gradiente, lixo)", () => {
    expect(parseCssColor("var(--primary)")).toBeNull();
    expect(parseCssColor("linear-gradient(red, blue)")).toBeNull();
    expect(parseCssColor("oklch(0.5 0.1)")).toBeNull();
    expect(parseCssColor("oklch(0.5 0.1 2 / 0.3 / 1)")).toBeNull();
  });

  it("parseOklchNumeric aceita %, none e alpha (ignorado)", () => {
    expect(parseOklchNumeric("oklch(50% 0.1 200 / 0.5)")).toEqual({ l: 0.5, c: 0.1, h: 200 });
    expect(parseOklchNumeric("oklch(0.4 0.02 none)")).toEqual({ l: 0.4, c: 0.02, h: 0 });
  });
});

describe("mixOklch (color-mix in oklch)", () => {
  const a = parseCssColor("oklch(0.2 0.1 10)")!;
  const b = parseCssColor("oklch(0.8 0.1 350)")!;

  it("interpola L/C e o hue pelo arco mais curto (10° ↔ 350° passa por 0°)", () => {
    const mixed = mixOklch(a, b, 0.5);
    expect(mixed.l).toBeCloseTo(0.5, 6);
    expect(mixed.c).toBeCloseTo(0.1, 6);
    expect(mixed.h).toBeCloseTo(0, 6);
  });

  it("com transparent: hue/L do outro lado, alpha pré-multiplicado", () => {
    const mixed = mixOklch(a, parseCssColor("transparent")!, 0.2);
    expect(mixed.alpha).toBeCloseTo(0.2, 6);
    expect(mixed.l).toBeCloseTo(0.2, 6); // pré-multiplicado: transparent não puxa L pra 0
    expect(mixed.h).toBeCloseTo(10, 6);
  });

  it("alphaScale (soma das porcentagens < 100) reduz o alpha", () => {
    expect(mixOklch(a, b, 0.5, 0.6).alpha).toBeCloseTo(0.6, 6);
  });
});

describe("formatOklch", () => {
  it("formato estrito, aceito pelo schema do documento de config", () => {
    expect(formatOklch({ l: 0.123456, c: 0.04567, h: 167.891 })).toBe("oklch(0.1235 0.0457 167.89)");
    expect(formatOklch({ l: 0.5, c: 0, h: 0, alpha: 0.5 })).toBe("oklch(0.5 0 0 / 0.5)");
    expect(THEME_COLOR_VALUE_PATTERN.test(formatOklch({ l: 1, c: 0.2, h: 30 }))).toBe(true);
  });
});
