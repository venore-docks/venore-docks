import { describe, expect, it } from "vitest";
import type { ThemeConfigDocument } from "@/contexts/themes/contracts/v8";
import { fontOptionsForRole } from "@/platform/theme-fonts/catalog";
import { withFontChoice } from "./fonts-panel";

const draft: ThemeConfigDocument = {
  schemaVersion: 1,
  themeKey: "demo",
  byTheme: { other: { palette: { mode: "default" }, options: {}, fonts: { sans: "inter" } } },
  assets: {},
  sections: [],
};

describe("FontsPanel — patch do rascunho", () => {
  it("grava a fonte em byTheme[tema].fonts sem tocar outros temas", () => {
    const patch = withFontChoice(draft, "demo", "display", "fraunces");
    expect(patch.byTheme.demo).toEqual({ palette: { mode: "default" }, options: {}, fonts: { display: "fraunces" } });
    expect(patch.byTheme.other).toBe(draft.byTheme.other);
  });

  it("'Padrão do tema' remove a escolha do papel", () => {
    expect(withFontChoice(draft, "other", "sans", null).byTheme.other.fonts).toEqual({});
  });

  it("oferece as choices do manifesto quando declaradas, senão o catálogo do papel", () => {
    expect(fontOptionsForRole("sans", { sans: ["inter", "manrope"] })).toEqual(["inter", "manrope"]);
    expect(fontOptionsForRole("mono", undefined)).toEqual(["geist-mono", "jetbrains-mono", "ibm-plex-mono"]);
    expect(fontOptionsForRole("sans", undefined)).toContain("noto-sans-arabic");
  });
});
