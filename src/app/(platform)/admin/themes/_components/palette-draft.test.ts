import { describe, expect, it } from "vitest";
import { defaultThemeConfigDocument, themeConfigDocumentSchema } from "@/contexts/themes/contracts/v8";
import { currentPaletteChoice, setCustomToken, toCustomChoice, toPickerHex, withPaletteChoice } from "./palette-draft";

describe("palette-draft", () => {
  const draft = defaultThemeConfigDocument("venore-slime");

  it("paleta é por tema: patch só mexe no byTheme do tema e preserva opções/fontes", () => {
    const withOther = {
      ...draft,
      byTheme: { aurora: { palette: { mode: "preset" as const, presetId: "oceano" }, options: { density: "compact" }, fonts: {} } },
    };
    const patch = withPaletteChoice(withOther, "aurora", { mode: "default" });
    expect(patch.byTheme.aurora).toEqual({ palette: { mode: "default" }, options: { density: "compact" }, fonts: {} });
    const patchSlime = withPaletteChoice(withOther, "venore-slime", { mode: "preset", presetId: "x" });
    expect(patchSlime.byTheme.aurora).toBe(withOther.byTheme.aurora);
    expect(patchSlime.byTheme["venore-slime"]).toEqual({ palette: { mode: "preset", presetId: "x" }, options: {}, fonts: {} });
    expect(themeConfigDocumentSchema.safeParse({ ...withOther, ...patchSlime }).success).toBe(true);
  });

  it("currentPaletteChoice cai no padrão sem entrada", () => {
    expect(currentPaletteChoice(draft, "nope")).toEqual({ mode: "default" });
  });

  it("personalizada parte dos tokens gerados de uma semente e edita/remove token", () => {
    const seed = { mode: "seed" as const, seed: "#3366cc", generated: { light: { primary: "#3366cc" }, dark: { primary: "#6688ee" } } };
    expect(toCustomChoice(seed)).toEqual({ mode: "custom", light: { primary: "#3366cc" }, dark: { primary: "#6688ee" } });
    expect(toCustomChoice({ mode: "preset", presetId: "a" })).toEqual({ mode: "custom", light: {}, dark: {} });
    const edited = setCustomToken(seed, "light", "background", "#ffffff");
    expect(edited.light).toEqual({ primary: "#3366cc", background: "#ffffff" });
    expect(seed.generated.light).toEqual({ primary: "#3366cc" }); // não muta
    expect(setCustomToken(edited, "light", "primary", null).light).toEqual({ background: "#ffffff" });
  });

  it("toPickerHex converte oklch e ignora o resto", () => {
    expect(toPickerHex("#AABBCC")).toBe("#aabbcc");
    expect(toPickerHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(toPickerHex("var(--x)")).toBeNull();
    expect(toPickerHex(undefined)).toBeNull();
  });
});
