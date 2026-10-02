import { describe, expect, it, vi } from "vitest";
import type { NextFontCall } from "@/test-support/themes/next-font-google-mock";
import type { FontId, FontRole, ResolvedThemeDefinition, ResolvedThemeOptions, ThemeOptionField } from "@/contexts/themes/contracts/v8";
import { FONT_IDS } from "@/contexts/themes/contracts/v8";

const calls: NextFontCall[] = vi.hoisted(() => []);
vi.mock("next/font/google", async () => (await import("@/test-support/themes/next-font-google-mock")).nextFontGoogleMock(calls));

const { resolveDocumentFonts, selectDocumentFonts } = await import("./resolve-document-fonts");
const { DEFAULT_FONT_CLASS_NAMES, FONT_VARIABLE_CLASS_NAMES } = await import("@/platform/theme-fonts/registry");
const { FONT_CATALOG } = await import("@/platform/theme-fonts/catalog");

function theme(
  fonts: Partial<Record<FontRole, string>> = {},
  extra: { options?: ThemeOptionField[]; fontChoices?: Partial<Record<FontRole, readonly FontId[]>>; key?: string } = {},
): ResolvedThemeDefinition {
  return {
    key: extra.key ?? "demo",
    fonts: { sans: "geist", display: fonts.sans ?? "geist", mono: "geist-mono", ...fonts },
    fontChoices: extra.fontChoices ?? {},
    options: extra.options ?? [],
  } as unknown as ResolvedThemeDefinition;
}
const noOptions: ResolvedThemeOptions = { values: {}, media: {}, ignored: [] };

describe("registro de fontes (next/font)", () => {
  it("cobre toda a whitelist FONT_IDS, com a variável do catálogo", () => {
    expect(Object.keys(FONT_VARIABLE_CLASS_NAMES).sort()).toEqual([...FONT_IDS].sort());
    for (const id of FONT_IDS) expect(FONT_VARIABLE_CLASS_NAMES[id]).toBe(`var${FONT_CATALOG[id].cssVariable}`);
  });

  it("só Geist e Geist Mono pré-carregam; RTL tem Noto Sans Arabic/Hebrew com o subset do script", () => {
    expect(calls).toHaveLength(FONT_IDS.length);
    for (const call of calls) {
      const preloads = call.options.preload !== false;
      expect([call.family, preloads]).toEqual([call.family, call.family === "Geist" || call.family === "Geist_Mono"]);
    }
    expect(calls.find((call) => call.family === "Noto_Sans_Arabic")?.options.subsets).toEqual(["arabic"]);
    expect(calls.find((call) => call.family === "Noto_Sans_Hebrew")?.options.subsets).toEqual(["hebrew"]);
  });
});

describe("resolveDocumentFonts", () => {
  it("tema sem escolha = Geist puro, CSS vazio (igual a antes da v8)", () => {
    expect(resolveDocumentFonts(theme(), undefined, noOptions, "public")).toEqual({ classNames: DEFAULT_FONT_CLASS_NAMES, css: "" });
  });

  it("aplica só as classes das fontes escolhidas e aponta --theme-font-* para elas", () => {
    const result = resolveDocumentFonts(theme({ sans: "inter", display: "fraunces", mono: "jetbrains-mono" }), undefined, noOptions, "public");
    expect(result.classNames.split(" ").sort()).toEqual(["var--font-fraunces", "var--font-inter", "var--font-jetbrains-mono"]);
    expect(result.classNames).not.toContain("geist");
    expect(result.css).toBe(
      'html[data-theme="demo"]{--theme-font-sans:var(--font-inter);--theme-font-mono:var(--font-jetbrains-mono);--theme-font-display:var(--font-fraunces)}',
    );
  });

  it("display igual ao sans não gera classe repetida nem declaração", () => {
    const result = resolveDocumentFonts(theme({ sans: "manrope" }), undefined, noOptions, "public");
    expect(result.classNames).toBe("var--font-manrope var--font-geist-mono");
    expect(result.css).toBe('html[data-theme="demo"]{--theme-font-sans:var(--font-manrope)}');
  });

  it("admin é sempre Geist, mesmo com tema e config escolhendo outra fonte", () => {
    const result = resolveDocumentFonts(theme({ sans: "inter" }), { sans: "fraunces", mono: "ibm-plex-mono" }, noOptions, "admin");
    expect(result).toEqual({ classNames: DEFAULT_FONT_CLASS_NAMES, css: "" });
  });

  it("fonte desconhecida cai no Geist (manifesto) ou é ignorada (opção/config)", () => {
    expect(resolveDocumentFonts(theme({ sans: "comic-sans", display: "comic-sans", mono: "papyrus" }), undefined, noOptions, "public")).toEqual({
      classNames: DEFAULT_FONT_CLASS_NAMES,
      css: "",
    });
    const stored = { sans: "comic-sans" } as unknown as Partial<Record<FontRole, FontId>>;
    expect(resolveDocumentFonts(theme({ sans: "inter" }), stored, noOptions, "public").css).toContain("var(--font-inter)");
  });

  it("precedência: manifesto ← opção font ← config salva", () => {
    const options: ThemeOptionField[] = [{ key: "body-font", label: "Fonte", type: "font", role: "sans" }];
    const values: ResolvedThemeOptions = { ...noOptions, values: { "body-font": "manrope" } };
    const base = theme({ sans: "inter", display: "inter" }, { options });
    expect(selectDocumentFonts(base, undefined, noOptions).sans).toBe("inter");
    expect(selectDocumentFonts(base, undefined, values).sans).toBe("manrope");
    expect(selectDocumentFonts(base, { sans: "space-grotesk" }, values).sans).toBe("space-grotesk");
  });

  it("com `choices` declarado, opção/config fora da lista é ignorada", () => {
    const base = theme({ sans: "inter" }, { fontChoices: { sans: ["inter", "manrope"] } });
    expect(selectDocumentFonts(base, { sans: "fraunces" }, noOptions).sans).toBe("inter");
    expect(selectDocumentFonts(base, { sans: "manrope" }, noOptions).sans).toBe("manrope");
  });

  it("Noto Sans Arabic é uma escolha válida (locale RTL)", () => {
    const result = resolveDocumentFonts(theme(), { sans: "noto-sans-arabic" }, noOptions, "public");
    expect(result.classNames).toContain("var--font-noto-sans-arabic");
    expect(result.css).toContain("--theme-font-sans:var(--font-noto-sans-arabic)");
  });

  it("chave de tema fora do padrão não vira seletor CSS", () => {
    expect(resolveDocumentFonts(theme({ sans: "inter" }, { key: 'x"]{}' }), undefined, noOptions, "public").css).toBe("");
  });
});
