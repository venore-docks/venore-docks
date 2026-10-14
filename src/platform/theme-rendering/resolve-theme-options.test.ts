import { describe, expect, it } from "vitest";
import { buildOptionsCssAndAttrs } from "./build-options-css";
import { resolveThemeOptions } from "./resolve-theme-options";
import { OPTION_FIELDS, themeWithOptions } from "./theme-options-pipeline.fixture";

const theme = themeWithOptions();

describe("resolveThemeOptions", () => {
  it("sem valor salvo ⇒ padrões do manifesto", () => {
    const r = resolveThemeOptions(theme, undefined, undefined);
    expect(r.values).toEqual({ density: "comfortable", rounded: true, gap: 1, brand: "#112233", tagline: "oi", logo: null, display: null });
    expect(r.ignored).toEqual([]);
    expect(r.media).toEqual({ logo: null });
  });

  it("salvo ← seção; inválido cai no padrão e entra em ignored", () => {
    const r = resolveThemeOptions(
      theme,
      { density: "compact", gap: 9, brand: "red;}", tagline: "longo demais aqui", zzz: 1, old: true, layout: "rail", "mobile-nav": "bottom-bar" },
      { gap: 0.5, rounded: "x" as unknown as boolean },
    );
    expect(r.values).toMatchObject({ density: "compact", gap: 0.5, brand: "#112233", tagline: "oi", rounded: true, layout: "rail" });
    expect(r.values["mobile-nav"]).toBeUndefined();
    expect(r.ignored).toEqual(
      expect.arrayContaining([
        { key: "gap", reason: "invalid" },
        { key: "brand", reason: "invalid" },
        { key: "tagline", reason: "invalid" },
        { key: "zzz", reason: "unknown" },
        { key: "old", reason: "removed" },
        { key: "mobile-nav", reason: "invalid" },
        { key: "rounded", reason: "invalid" },
      ]),
    );
  });

  it("mídia vira URL codificada; id inválido ⇒ null", () => {
    expect(resolveThemeOptions(theme, { logo: "abc-123" }, undefined).media.logo).toEqual({ url: "/api/media/asset/abc-123", alt: "" });
    expect(resolveThemeOptions(theme, { logo: "../x" }, undefined).media.logo).toBeNull();
  });
});

describe("buildOptionsCssAndAttrs", () => {
  const resolved = (stored = {}) => resolveThemeOptions(theme, stored, undefined);

  it("select/boolean ⇒ atributos; range/color ⇒ vars no seletor do tema", () => {
    const out = buildOptionsCssAndAttrs(OPTION_FIELDS, resolved({ density: "compact", rounded: false, gap: 1.25 }), { themeKey: "aurora" });
    expect(out.attributes).toEqual({ "data-opt-density": "compact", "data-opt-rounded": "false" });
    expect(out.css).toBe('html[data-theme="aurora"]{--opt-gap:1.25rem;--opt-brand:#112233;}');
  });

  it("nada fora da whitelist chega ao CSS/atributos, mesmo com valores forjados", () => {
    const forged = { values: { density: 'x"><script>', rounded: "true", gap: Infinity, brand: "red}body{color:red", tagline: "</style>" }, media: {}, ignored: [] };
    const out = buildOptionsCssAndAttrs(OPTION_FIELDS, forged, { themeKey: "aurora" });
    expect(out).toEqual({ css: "", attributes: {} });
  });

  it("chave de tema/escopo inseguros ⇒ sem CSS; scope substitui o seletor; admin ⇒ nada", () => {
    expect(buildOptionsCssAndAttrs(OPTION_FIELDS, resolved(), { themeKey: 'a"]{' }).css).toBe("");
    expect(buildOptionsCssAndAttrs(OPTION_FIELDS, resolved(), { themeKey: "aurora", scope: "x{}</style>" }).css).toBe("");
    expect(buildOptionsCssAndAttrs(OPTION_FIELDS, resolved(), { themeKey: "aurora", scope: "[data-gallery-root]" }).css).toMatch(/^\[data-gallery-root\]\{/);
    expect(buildOptionsCssAndAttrs(OPTION_FIELDS, resolved(), { themeKey: "aurora", area: "admin" })).toEqual({ css: "", attributes: {} });
  });

  it("tema sem opções (slime) ⇒ vazio (paridade)", () => {
    expect(buildOptionsCssAndAttrs([], resolveThemeOptions(themeWithOptions([]), undefined, undefined), { themeKey: "venore-slime" })).toEqual({ css: "", attributes: {} });
  });
});
