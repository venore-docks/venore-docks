import { describe, expect, it } from "vitest";
import { hexToOklch, isValidHexColor, oklchToHex, parseOklchNumeric } from "./oklch-color";

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
