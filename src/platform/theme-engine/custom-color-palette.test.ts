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
      error: { code: "theme-engine.palette.low_contrast", message: expect.any(String) },
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
      error: { code: "theme-engine.palette.low_contrast", message: expect.any(String) },
    });
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("aceita tokens tier-3 de região (region-<região>-<papel>)", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", {
      light: { "region-rail-background": "#1a1a1a", "region-rail-foreground": "#f5f5f5" },
      dark: {},
    });
    expect(result.success).toBe(true);
  });

  it("recusa token de região inexistente", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", { light: { "region-sidebar-background": "#1a1a1a" }, dark: {} });
    expect(result).toMatchObject({ success: false, error: { code: "theme-engine.custom_color_palette.invalid_value" } });
  });

  it("delegando ao checador por região: muted-foreground/fundo baixo no rail é recusado e a região aparece na mensagem", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", {
      light: {},
      dark: { "region-rail-background": "#202020", "region-rail-muted-foreground": "#333333" },
    });
    expect(result).toMatchObject({ success: false, error: { code: "theme-engine.palette.low_contrast" } });
    if (!result.success) {
      expect(result.error.message).toContain("rail");
      expect(result.error.message).toContain("modo escuro");
    }
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("par não-textual (accent/fundo) abaixo de 3:1 não barra o save", async () => {
    const { setCustomColorPalette } = await import("./custom-color-palette");
    const result = await setCustomColorPalette("venore-slime", {
      light: { background: "#ffffff", foreground: "#111111", accent: "#fafafa" },
      dark: {},
    });
    expect(result.success).toBe(true);
  });

  it("minContrast da regra da região eleva o mínimo de texto", async () => {
    const { findCustomPaletteContrastProblem } = await import("./custom-color-palette");
    // ~5.7:1 — passa no 4.5 padrão, falha com minContrast 7.
    const tokens = { light: { "region-footer-background": "#ffffff", "region-footer-foreground": "#6b6b6b" }, dark: {} };
    expect(findCustomPaletteContrastProblem(tokens)).toBeNull();
    expect(findCustomPaletteContrastProblem(tokens, { regions: { footer: { tone: "light", minContrast: 7 } } })).toMatchObject({
      regions: ["footer"],
    });
  });
});

describe("paletas do '1 cor de marca' continuam aceitas (sem regressão do checador por região)", () => {
  it("toda semente do golden passa no checador de texto", async () => {
    const golden = (await import("./palette/__golden__/legacy-generators.golden.json")).default;
    const { findCustomPaletteContrastProblem } = await import("./custom-color-palette");
    for (const palette of Object.values(golden.fullFromHex)) {
      expect(findCustomPaletteContrastProblem(palette)).toBeNull();
    }
  });
});
