import { beforeEach, describe, expect, it, vi } from "vitest";

const getCachedCategoryBySlug = vi.fn();
const listEntries = vi.fn();
const listContentTypes = vi.fn();
const getMediaAssetImages = vi.fn();

vi.mock("@/contexts/cms", () => ({
  getCachedCategoryBySlug: (slug: string) => getCachedCategoryBySlug(slug),
  listEntries: (query: unknown) => listEntries(query),
  listContentTypes: () => listContentTypes(),
  extractEntryComposition: () => [],
}));
vi.mock("@/contexts/media", () => ({ getMediaAssetImages: (query: unknown) => getMediaAssetImages(query) }));
vi.mock("@/platform/seo/entry-excerpt", () => ({ extractExcerpt: () => "resumo" }));

const { loadEntryFeed } = await import("./load-entry-feed");

const record = { id: "e1", title: "Uma", slug: "uma", data: {}, mediaId: null, publishedAt: new Date("2026-11-01T12:00:00Z") };

describe("loadEntryFeed", () => {
  beforeEach(() => {
    getCachedCategoryBySlug.mockReset();
    listEntries.mockReset();
    listContentTypes.mockReset();
    getMediaAssetImages.mockReset();
    getCachedCategoryBySlug.mockResolvedValue({ success: true, data: { id: "c1", name: "Notícias", slug: "noticias" } });
    listEntries.mockResolvedValue({ success: true, data: [record] });
    getMediaAssetImages.mockResolvedValue({ success: true, data: {} });
    listContentTypes.mockResolvedValue({ success: true, data: [{ id: "t-camp", key: "campanhas", name: "Campanhas", entryCount: 3 }] });
  });

  it("sem tipo: lista a categoria inteira, só públicas para visitante", async () => {
    const feed = await loadEntryFeed({ categorySlug: "noticias", limit: 3, viewerIsAuthenticated: false });
    expect(listEntries).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "c1", visibility: "public", limit: 3 }));
    expect(listEntries.mock.calls[0][0]).not.toHaveProperty("contentTypeId");
    expect(feed?.items).toHaveLength(1);
    expect(feed?.typeNotFound).toBe(false);
  });

  it("capa: pede a variante do tamanho do card e repassa proporção e 'fixado'", async () => {
    listEntries.mockResolvedValue({
      success: true,
      data: [{ ...record, mediaId: "m1", pinnedAt: new Date("2026-11-10T12:00:00Z") }],
    });
    getMediaAssetImages.mockResolvedValue({ success: true, data: { m1: { url: "https://cdn.test/m1.w960.webp", width: 1080, height: 1350 } } });
    const feed = await loadEntryFeed({ categorySlug: "noticias", limit: 3, viewerIsAuthenticated: true });
    expect(getMediaAssetImages).toHaveBeenCalledWith({ ids: ["m1"], displayWidth: 480 });
    expect(feed?.items[0]).toMatchObject({ coverUrl: "https://cdn.test/m1.w960.webp", coverWidth: 1080, coverHeight: 1350, pinned: true });
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
