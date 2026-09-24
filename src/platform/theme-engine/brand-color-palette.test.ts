import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ColorPalette } from "@/contexts/themes";
import { buildBrandHueTokens } from "./brand-color-palette";

const TEMPLATE: ColorPalette = {
  id: "oceano",
  name: "Oceano",
  light: {
    primary: "oklch(0.53 0.21 245)",
    "primary-foreground": "oklch(0.98 0.01 245)",
    accent: "oklch(0.93 0.035 210)",
    "accent-foreground": "oklch(0.28 0.03 210)",
    ring: "oklch(0.53 0.18 245)",
  },
  dark: {
    primary: "oklch(0.72 0.19 245)",
    "primary-foreground": "oklch(0.16 0.02 245)",
    accent: "oklch(0.32 0.05 210)",
    "accent-foreground": "oklch(0.94 0.02 210)",
    ring: "oklch(0.68 0.18 245)",
  },
};

describe("buildBrandHueTokens", () => {
  it("deriva os 5 tokens de marca, em hex, pros dois modos", () => {
    const result = buildBrandHueTokens("#006b82", TEMPLATE);

    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const mode of ["light", "dark"] as const) {
      for (const token of ["primary", "primary-foreground", "accent", "accent-foreground", "ring"] as const) {
        expect(result.data[mode][token]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("rejeita hex inválido", () => {
    const result = buildBrandHueTokens("azul", TEMPLATE);
    expect(result).toEqual({
      success: false,
      error: { code: "theme-engine.brand_color_palette.invalid_value", message: expect.any(String) },
    });
  });

  it("pula tokens ausentes no template sem erro", () => {
    const partialTemplate: ColorPalette = {
      id: "x",
      name: "X",
      light: { primary: "oklch(0.53 0.21 245)" },
      dark: {},
    };
    const result = buildBrandHueTokens("#006b82", partialTemplate);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.keys(result.data.light)).toEqual(["primary"]);
    expect(result.data.dark).toEqual({});
  });

  it("erro quando o template não tem NENHUM token de marca em nenhum modo", () => {
    const emptyTemplate: ColorPalette = { id: "x", name: "X", light: {}, dark: {} };
    const result = buildBrandHueTokens("#006b82", emptyTemplate);

    expect(result).toEqual({
      success: false,
      error: { code: "theme-engine.brand_color_palette.empty_template", message: expect.any(String) },
    });
  });
});

const setSetting = vi.fn();
const getSetting = vi.fn();
vi.mock("@/contexts/settings", () => ({
  setSetting: (...args: unknown[]) => setSetting(...args),
  getSetting: (...args: unknown[]) => getSetting(...args),
}));

const resolveActiveTheme = vi.fn();
vi.mock("@/platform/theme-rendering/resolve-active-theme", () => ({
  resolveActiveTheme: (...args: unknown[]) => resolveActiveTheme(...args),
}));

describe("setBrandColorPalette", () => {
  beforeEach(() => {
    setSetting.mockReset();
    getSetting.mockReset();
    resolveActiveTheme.mockReset();
    setSetting.mockResolvedValue({ success: true, data: { updatedAt: new Date() } });
  });

  it("mescla os 5 tokens de marca por cima da paleta personalizada já salva", async () => {
    resolveActiveTheme.mockResolvedValue({ manifest: { key: "venore-slime" }, colorPalettes: [TEMPLATE] });
    getSetting.mockResolvedValue({
      success: true,
      data: { value: { light: { background: "#f5f7fa" }, dark: {} } },
    });

    const { setBrandColorPalette } = await import("./brand-color-palette");
    const result = await setBrandColorPalette({ hex: "#006b82" });

    expect(result.success).toBe(true);
    expect(setSetting).toHaveBeenCalledTimes(1);
    const [{ value }] = setSetting.mock.calls[0];
    // token estrutural prévio sobrevive...
    expect(value.light.background).toBe("#f5f7fa");
    // ...e os 5 tokens de marca aparecem, todos em hex (nunca oklch — regressão do bug pego na
    // fase de design: a storage só aceita #rrggbb).
    expect(value.light.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(value.dark.ring).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("erro quando o tema ativo não tem catálogo", async () => {
    resolveActiveTheme.mockResolvedValue({ manifest: { key: "sem-catalogo" }, colorPalettes: [] });

    const { setBrandColorPalette } = await import("./brand-color-palette");
    const result = await setBrandColorPalette({ hex: "#006b82" });

    expect(result).toEqual({
      success: false,
      error: { code: "theme-engine.brand_color_palette.no_catalog", message: expect.any(String) },
    });
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("propaga erro de hex inválido sem gravar", async () => {
    resolveActiveTheme.mockResolvedValue({ manifest: { key: "venore-slime" }, colorPalettes: [TEMPLATE] });

    const { setBrandColorPalette } = await import("./brand-color-palette");
    const result = await setBrandColorPalette({ hex: "azul" });

    expect(result.success).toBe(false);
    expect(setSetting).not.toHaveBeenCalled();
  });
});
