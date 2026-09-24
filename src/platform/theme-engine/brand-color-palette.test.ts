import { beforeEach, describe, expect, it, vi } from "vitest";

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
    resolveActiveTheme.mockResolvedValue({ manifest: { key: "venore-slime" }, colorPalettes: [] });
  });

  it("gera e salva os 9 tokens, em hex, pros dois modos", async () => {
    const { setBrandColorPalette } = await import("./brand-color-palette");
    const result = await setBrandColorPalette({ hex: "#006b82" });

    expect(result.success).toBe(true);
    expect(setSetting).toHaveBeenCalledTimes(1);
    const [{ value }] = setSetting.mock.calls[0];
    for (const mode of ["light", "dark"] as const) {
      for (const token of [
        "primary",
        "primary-foreground",
        "secondary",
        "secondary-foreground",
        "background",
        "foreground",
        "accent",
        "accent-foreground",
        "ring",
      ]) {
        expect(value[mode][token]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("funciona mesmo com o catálogo do tema ativo vazio (não depende mais dele)", async () => {
    resolveActiveTheme.mockResolvedValue({ manifest: { key: "sem-catalogo" }, colorPalettes: [] });

    const { setBrandColorPalette } = await import("./brand-color-palette");
    const result = await setBrandColorPalette({ hex: "#006b82" });

    expect(result.success).toBe(true);
  });

  it("rejeita hex inválido, sem gravar", async () => {
    const { setBrandColorPalette } = await import("./brand-color-palette");
    const result = await setBrandColorPalette({ hex: "azul" });

    expect(result).toEqual({
      success: false,
      error: { code: "theme-engine.brand_color_palette.invalid_value", message: expect.any(String) },
    });
    expect(setSetting).not.toHaveBeenCalled();
  });
});

describe("setPresetColorPalette", () => {
  beforeEach(() => {
    setSetting.mockReset();
    getSetting.mockReset();
    resolveActiveTheme.mockReset();
    setSetting.mockResolvedValue({ success: true, data: { updatedAt: new Date() } });
  });

  it("extrai o primary do preset como semente e gera os 9 tokens", async () => {
    resolveActiveTheme.mockResolvedValue({
      manifest: { key: "venore-slime" },
      colorPalettes: [
        {
          id: "espaco",
          name: "Espaço",
          light: { primary: "oklch(0.53 0.21 245)" },
          dark: { primary: "oklch(0.72 0.19 245)" },
        },
      ],
    });

    const { setPresetColorPalette } = await import("./brand-color-palette");
    const result = await setPresetColorPalette("espaco");

    expect(result.success).toBe(true);
    const [{ value }] = setSetting.mock.calls[0];
    expect(value.light.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(value.light.secondary).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("erro quando o preset não existe no catálogo do tema ativo", async () => {
    resolveActiveTheme.mockResolvedValue({ manifest: { key: "venore-slime" }, colorPalettes: [] });

    const { setPresetColorPalette } = await import("./brand-color-palette");
    const result = await setPresetColorPalette("nao-existe");

    expect(result).toEqual({
      success: false,
      error: { code: "theme-engine.brand_color_palette.preset_not_found", message: expect.any(String) },
    });
    expect(setSetting).not.toHaveBeenCalled();
  });
});
