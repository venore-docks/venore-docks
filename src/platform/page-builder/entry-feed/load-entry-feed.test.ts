import { beforeEach, describe, expect, it, vi } from "vitest";

const getCachedCategoryBySlug = vi.fn();
const listEntries = vi.fn();
const listContentTypes = vi.fn();
const getMediaAssetUrls = vi.fn();

vi.mock("@/contexts/cms", () => ({
  getCachedCategoryBySlug: (slug: string) => getCachedCategoryBySlug(slug),
  listEntries: (query: unknown) => listEntries(query),
  listContentTypes: () => listContentTypes(),
  extractEntryComposition: () => [],
}));
vi.mock("@/contexts/media", () => ({ getMediaAssetUrls: (query: unknown) => getMediaAssetUrls(query) }));
vi.mock("@/platform/seo/entry-excerpt", () => ({ extractExcerpt: () => "resumo" }));

const { loadEntryFeed } = await import("./load-entry-feed");

const record = { id: "e1", title: "Uma", slug: "uma", data: {}, mediaId: null, publishedAt: new Date("2026-11-01T12:00:00Z") };

describe("loadEntryFeed", () => {
  beforeEach(() => {
    getCachedCategoryBySlug.mockReset();
    listEntries.mockReset();
    listContentTypes.mockReset();
    getMediaAssetUrls.mockReset();
    getCachedCategoryBySlug.mockResolvedValue({ success: true, data: { id: "c1", name: "Notícias", slug: "noticias" } });
    listEntries.mockResolvedValue({ success: true, data: [record] });
    getMediaAssetUrls.mockResolvedValue({ success: true, data: {} });
    listContentTypes.mockResolvedValue({ success: true, data: [{ id: "t-camp", key: "campanhas", name: "Campanhas", entryCount: 3 }] });
  });

  it("sem tipo: lista a categoria inteira, só públicas para visitante", async () => {
    const feed = await loadEntryFeed({ categorySlug: "noticias", limit: 3, viewerIsAuthenticated: false });
    expect(listEntries).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "c1", visibility: "public", limit: 3 }));
    expect(listEntries.mock.calls[0][0]).not.toHaveProperty("contentTypeId");
    expect(feed?.items).toHaveLength(1);
    expect(feed?.typeNotFound).toBe(false);
  });

  it("com tipo existente: filtra por content type no banco", async () => {
    await loadEntryFeed({ categorySlug: "noticias", limit: 3, viewerIsAuthenticated: true, typeKey: "campanhas" });
    expect(listEntries).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "c1", contentTypeId: "t-camp" }));
  });

  it("tipo que não existe: feed vazio (não cai em 'todos') e sinaliza typeNotFound", async () => {
    const feed = await loadEntryFeed({ categorySlug: "noticias", limit: 3, viewerIsAuthenticated: true, typeKey: "nao-existe" });
    expect(listEntries).not.toHaveBeenCalled();
    expect(feed).toEqual(expect.objectContaining({ items: [], typeNotFound: true }));
  });

  it("categoria inexistente devolve null", async () => {
    getCachedCategoryBySlug.mockResolvedValue({ success: true, data: null });
    expect(await loadEntryFeed({ categorySlug: "x", limit: 3, viewerIsAuthenticated: false })).toBeNull();
  });
});
