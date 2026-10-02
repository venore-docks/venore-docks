import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PAGE_LAYOUT, type ResolvedThemeDefinition, type ThemeSectionOverride } from "@/contexts/themes/contracts/v8";

// resolvePageLayout reaproveita as funções cache() que o breadcrumb e a página do catch-all já
// chamam (mesmos argumentos) — o mock do barrel só expõe ESSAS duas: qualquer outra leitura do CMS
// (query extra) quebraria o teste com "não é função".
const getCachedCategoryBySlug = vi.fn();
const getCachedPublishedEntryBySlug = vi.fn();
vi.mock("@/contexts/cms", () => ({
  getCachedCategoryBySlug: (...args: unknown[]) => getCachedCategoryBySlug(...args),
  getCachedPublishedEntryBySlug: (...args: unknown[]) => getCachedPublishedEntryBySlug(...args),
}));

const { mergePageLayout, pageLayoutMarkerAttributes, resolvePageLayout } = await import("./page-layout");

const theme = { templateVariants: { entry: [{ value: "magazine", label: "Revista" }] } } as unknown as ResolvedThemeDefinition;
const section = (page: ThemeSectionOverride["page"], templates?: ThemeSectionOverride["templates"]): ThemeSectionOverride => ({
  id: "s1",
  label: "Blog",
  pathPrefix: "/blog",
  page,
  templates,
});
const entryWith = (layout: unknown) => ({ success: true, data: { id: "e1", data: { blocks: [], layout } } });
const noRow = { success: true, data: null };

describe("mergePageLayout — precedência entry → seção → tema", () => {
  it("sem nada declarado = padrão de hoje", () => {
    expect(mergePageLayout({}, null, theme)).toEqual(DEFAULT_PAGE_LAYOUT);
  });

  it("seção sobrepõe o tema; entry sobrepõe a seção; auto herda", () => {
    const s = section({ width: "wide", showRail: false, contextualPlacement: "top" }, { entry: "magazine" });
    expect(mergePageLayout({}, s, theme)).toEqual({ width: "wide", showRail: false, contextualPlacement: "top", template: "magazine" });
    expect(mergePageLayout({ width: "full", contextualBar: "none" }, s, theme)).toEqual({
      width: "full",
      showRail: false,
      contextualPlacement: "none",
      template: "magazine",
    });
    expect(mergePageLayout({ rail: "auto", contextualBar: "auto" }, s, theme).contextualPlacement).toBe("top");
    expect(mergePageLayout({ rail: "hidden" }, null, theme).showRail).toBe(false);
  });

  it("variante de template não declarada pelo tema cai no padrão (null)", () => {
    expect(mergePageLayout({ template: "magazine" }, null, theme).template).toBe("magazine");
    expect(mergePageLayout({ template: "poster" }, null, theme).template).toBeNull();
  });

  it("valores de seção fora do vocabulário são ignorados", () => {
    expect(mergePageLayout({}, section({ width: "huge" as never, contextualPlacement: "left" as never }), theme)).toEqual(DEFAULT_PAGE_LAYOUT);
  });
});

describe("resolvePageLayout — sem query extra", () => {
  beforeEach(() => {
    getCachedCategoryBySlug.mockReset();
    getCachedPublishedEntryBySlug.mockReset();
  });

  it("entry raiz: categoria (precedência BL1) e entry pelas MESMAS chaves do breadcrumb", async () => {
    getCachedCategoryBySlug.mockResolvedValue(noRow);
    getCachedPublishedEntryBySlug.mockResolvedValue(entryWith({ width: "full", rail: "hidden" }));
    const layout = await resolvePageLayout("/sobre", theme as ResolvedThemeDefinition, null);
    expect(layout).toMatchObject({ width: "full", showRail: false });
    expect(getCachedCategoryBySlug).toHaveBeenCalledWith("sobre");
    expect(getCachedPublishedEntryBySlug).toHaveBeenCalledWith(null, "sobre");
  });

  it("entry dentro de categoria", async () => {
    getCachedCategoryBySlug.mockResolvedValue({ success: true, data: { id: "cat-1", slug: "blog" } });
    getCachedPublishedEntryBySlug.mockResolvedValue(entryWith({ contextualBar: "top" }));
    const layout = await resolvePageLayout("/blog/post", theme as ResolvedThemeDefinition, section({ width: "wide" }));
    expect(layout).toMatchObject({ width: "wide", contextualPlacement: "top" });
    expect(getCachedPublishedEntryBySlug).toHaveBeenCalledWith("cat-1", "post");
  });

  it("página de categoria, admin, ext/api e caminhos fundos não leem entry", async () => {
    getCachedCategoryBySlug.mockResolvedValue({ success: true, data: { id: "cat-1", slug: "blog" } });
    expect(await resolvePageLayout("/blog", theme as ResolvedThemeDefinition, null)).toEqual(DEFAULT_PAGE_LAYOUT);
    expect(await resolvePageLayout("/admin/cms", theme as ResolvedThemeDefinition, section({ width: "full" }))).toEqual(DEFAULT_PAGE_LAYOUT);
    expect(await resolvePageLayout("/api/x", theme as ResolvedThemeDefinition, null)).toEqual(DEFAULT_PAGE_LAYOUT);
    expect(await resolvePageLayout("/a/b/c", theme as ResolvedThemeDefinition, null)).toEqual(DEFAULT_PAGE_LAYOUT);
    expect(getCachedPublishedEntryBySlug).not.toHaveBeenCalled();
  });

  it("layout guardado inválido é ignorado campo a campo; erro de leitura não derruba", async () => {
    getCachedCategoryBySlug.mockResolvedValue(noRow);
    getCachedPublishedEntryBySlug.mockResolvedValue(entryWith({ width: "giant", rail: "hidden" }));
    expect(await resolvePageLayout("/x", theme as ResolvedThemeDefinition, null)).toMatchObject({ width: "contained", showRail: false });
    getCachedCategoryBySlug.mockRejectedValue(new Error("db"));
    expect(await resolvePageLayout("/y", theme as ResolvedThemeDefinition, null)).toEqual(DEFAULT_PAGE_LAYOUT);
  });

  it("home lê a entry reservada 'home'", async () => {
    getCachedPublishedEntryBySlug.mockResolvedValue(entryWith({ width: "wide" }));
    expect((await resolvePageLayout("/", theme as ResolvedThemeDefinition, null)).width).toBe("wide");
    expect(getCachedPublishedEntryBySlug).toHaveBeenCalledWith(null, "home");
  });
});

describe("marcadores data-page-*", () => {
  it("espelham o layout resolvido", () => {
    expect(pageLayoutMarkerAttributes({ width: "full", showRail: false, contextualPlacement: "none", template: null })).toEqual({
      "data-page-layout": "",
      "data-page-width": "full",
      "data-page-rail": "hidden",
      "data-page-contextual": "none",
    });
  });
});
