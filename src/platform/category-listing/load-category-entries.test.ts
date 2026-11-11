import { beforeEach, describe, expect, it, vi } from "vitest";

const listEntries = vi.fn();
const getMediaAssetUrls = vi.fn();

vi.mock("@/contexts/cms", () => ({
  listEntries: (query: unknown) => listEntries(query),
  extractEntryComposition: () => [],
}));
vi.mock("@/contexts/media", () => ({ getMediaAssetUrls: (query: unknown) => getMediaAssetUrls(query) }));
vi.mock("@/platform/seo/entry-excerpt", () => ({ extractExcerpt: () => "resumo" }));

const { CATEGORY_LIST_PAGE_SIZE, loadCategoryEntries } = await import("./load-category-entries");

const category = { id: "cat-1", name: "Notícias", slug: "noticias" };

function record(index: number, mediaId: string | null = null) {
  return {
    id: `e${index}`,
    title: `Entrada ${index}`,
    slug: `entrada-${index}`,
    data: {},
    mediaId,
    publishedAt: new Date("2026-10-01T12:00:00Z"),
    updatedAt: new Date("2026-10-02T12:00:00Z"),
    visibility: "public",
  };
}

describe("loadCategoryEntries", () => {
  beforeEach(() => {
    listEntries.mockReset();
    getMediaAssetUrls.mockReset();
    getMediaAssetUrls.mockResolvedValue({ success: true, data: { m1: "https://cdn.test/capa.jpg" } });
  });

  it("visitante sem sessão só pede entries públicas (filtro no banco, antes da paginação)", async () => {
    listEntries.mockResolvedValue({ success: true, data: [] });
    await loadCategoryEntries({ category, page: 1, viewerIsAuthenticated: false });
    expect(listEntries).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "cat-1", visibility: "public" }));
  });

  it("logado não filtra por visibilidade", async () => {
    listEntries.mockResolvedValue({ success: true, data: [] });
    await loadCategoryEntries({ category, page: 1, viewerIsAuthenticated: true });
    expect(listEntries.mock.calls[0][0]).not.toHaveProperty("visibility");
  });

  it("calcula offset pela página e pede um item a mais pra saber se há próxima", async () => {
    listEntries.mockResolvedValue({ success: true, data: [] });
    await loadCategoryEntries({ category, page: 3, viewerIsAuthenticated: true });
    expect(listEntries).toHaveBeenCalledWith(
      expect.objectContaining({ limit: CATEGORY_LIST_PAGE_SIZE + 1, offset: 2 * CATEGORY_LIST_PAGE_SIZE }),
    );
  });

  it("corta o item extra e marca hasNextPage", async () => {
    const fetched = Array.from({ length: CATEGORY_LIST_PAGE_SIZE + 1 }, (_, index) => record(index));
    listEntries.mockResolvedValue({ success: true, data: fetched });
    const page = await loadCategoryEntries({ category, page: 1, viewerIsAuthenticated: true });
    expect(page.entries).toHaveLength(CATEGORY_LIST_PAGE_SIZE);
    expect(page.records).toHaveLength(CATEGORY_LIST_PAGE_SIZE);
    expect(page.hasNextPage).toBe(true);
  });

  it("último lote: sem próxima página", async () => {
    listEntries.mockResolvedValue({ success: true, data: [record(1)] });
    const page = await loadCategoryEntries({ category, page: 2, viewerIsAuthenticated: true });
    expect(page.hasNextPage).toBe(false);
  });

  it("monta o card com caminho, categoria, capa e resumo", async () => {
    listEntries.mockResolvedValue({ success: true, data: [record(1, "m1")] });
    const { entries } = await loadCategoryEntries({ category, page: 1, viewerIsAuthenticated: true });
    expect(entries[0]).toMatchObject({
      id: "e1",
      path: "/noticias/entrada-1",
      excerpt: "resumo",
      category: { label: "Notícias", href: "/noticias" },
      cover: { url: "https://cdn.test/capa.jpg", alt: "" },
    });
  });

  it("falha na consulta vira lista vazia, sem lançar", async () => {
    listEntries.mockResolvedValue({ success: false, error: { code: "x", message: "y" } });
    const page = await loadCategoryEntries({ category, page: 1, viewerIsAuthenticated: false });
    expect(page).toEqual({ records: [], entries: [], hasNextPage: false });
  });
});
