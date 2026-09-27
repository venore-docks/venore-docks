import { beforeEach, describe, expect, it, vi } from "vitest";

const setSetting = vi.fn();
const getSetting = vi.fn();
vi.mock("@/contexts/settings", () => ({
  setSetting: (...args: unknown[]) => setSetting(...args),
  getSetting: (...args: unknown[]) => getSetting(...args),
}));

describe("setCustomColorPalette", () => {
  beforeEach(() => {
    setSetting.mockReset();
    getSetting.mockReset();
    setSetting.mockResolvedValue({ success: true, data: { updatedAt: new Date() } });
  });

  it("grava com a chave keyed no themeKey", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    await setCustomColorPalette("venore-frost", {
      light: { foreground: "#1f2933", background: "#f5f7fa" },
      dark: {},
    });

    expect(setSetting).toHaveBeenCalledWith({
      key: "theme.customColorPalette.venore-frost",
      value: { light: { foreground: "#1f2933", background: "#f5f7fa" }, dark: {} },
    });
  });

  it("recusa hex inválido, sem gravar", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", { light: { primary: "roxo" }, dark: {} });

    expect(result).toEqual({
      success: false,
      error: { code: "theme-engine.custom_color_palette.invalid_value", message: expect.any(String) },
    });
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("recusa contraste texto/fundo abaixo de 4.5:1, sem gravar", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", {
      light: { foreground: "#ffffff", background: "#fefefe" },
      dark: {},
    });

    expect(result).toEqual({
      success: false,
      error: { code: "theme-engine.custom_color_palette.low_contrast", message: expect.any(String) },
    });
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("não checa contraste quando só um dos dois tokens do par existe no modo", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", { light: { primary: "#abcdef" }, dark: {} });

    expect(result.success).toBe(true);
    expect(setSetting).toHaveBeenCalled();
  });

  it("aceita os tokens ampliados (sidebar/header/superfícies), fora do subconjunto original de 9", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", {
      light: { card: "#ffffff", "sidebar-bg-start": "#111111", "header-bg": "#eeeeee" },
      dark: {},
    });

    expect(result.success).toBe(true);
  });

  it("recusa contraste texto/card abaixo de 4.5:1, sem gravar", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", {
      light: { "card-foreground": "#ffffff", card: "#fefefe" },
      dark: {},
    });

    expect(result).toEqual({
      success: false,
      error: { code: "theme-engine.custom_color_palette.low_contrast", message: expect.any(String) },
    });
    expect(setSetting).not.toHaveBeenCalled();
  });
});
