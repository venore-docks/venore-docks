import { describe, expect, it } from "vitest";
import { THEME_COLOR_VALUE_PATTERN, defaultThemeConfigDocument, parseThemeConfigDocument } from "./config-document";

describe("themeConfigDocumentSchema", () => {
  it("aceita o documento padrão", () => {
    expect(parseThemeConfigDocument(defaultThemeConfigDocument())).not.toBeNull();
  });

  it("é .strict(): campo desconhecido invalida", () => {
    expect(parseThemeConfigDocument({ ...defaultThemeConfigDocument(), surprise: 1 })).toBeNull();
  });

  it("cor só hex ou oklch estrito (nada que feche a regra CSS)", () => {
    expect(THEME_COLOR_VALUE_PATTERN.test("#1f5d43")).toBe(true);
    expect(THEME_COLOR_VALUE_PATTERN.test("oklch(0.5 0.1 120)")).toBe(true);
    expect(THEME_COLOR_VALUE_PATTERN.test("oklch(52% 0.1 120 / 0.5)")).toBe(true);
    expect(THEME_COLOR_VALUE_PATTERN.test("red; } body { x: y")).toBe(false);
    expect(THEME_COLOR_VALUE_PATTERN.test("url(x)")).toBe(false);
  });

  it("limita seções e valida fontes contra FONT_IDS", () => {
    const base = defaultThemeConfigDocument();
    expect(parseThemeConfigDocument({ ...base, byTheme: { "venore-slime": { palette: { mode: "default" }, options: {}, fonts: { sans: "comic-sans" } } } })).toBeNull();
    const section = { id: "s", label: "S", pathPrefix: "/rh" };
    expect(parseThemeConfigDocument({ ...base, sections: Array.from({ length: 31 }, () => section) })).toBeNull();
    expect(parseThemeConfigDocument({ ...base, sections: [section] })).not.toBeNull();
  });
});
