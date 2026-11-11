import { beforeEach, describe, expect, it, vi } from "vitest";

const getCachedCategoryBySlug = vi.fn();
const getCurrentUser = vi.fn();
const loadCategoryEntries = vi.fn();

vi.mock("@/contexts/cms", () => ({ getCachedCategoryBySlug: (slug: string) => getCachedCategoryBySlug(slug) }));
vi.mock("@/contexts/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/platform/category-listing/load-category-entries", () => ({
  loadCategoryEntries: (input: unknown) => loadCategoryEntries(input),
}));
vi.mock("@/infrastructure/rate-limit", () => ({
  checkRateLimitInMemory: () => ({ allowed: true }),
  getClientIp: () => "127.0.0.1",
}));

const { GET } = await import("./route");

function call(query: string) {
  return GET(new Request(`https://portal.test/api/category-entries${query}`));
}

describe("GET /api/category-entries", () => {
  beforeEach(() => {
    getCachedCategoryBySlug.mockReset();
    getCurrentUser.mockReset();
    loadCategoryEntries.mockReset();
    getCachedCategoryBySlug.mockResolvedValue({ success: true, data: { id: "c1", name: "Notícias", slug: "noticias" } });
    getCurrentUser.mockResolvedValue({ success: true, data: null });
    loadCategoryEntries.mockResolvedValue({ entries: [], hasNextPage: false, records: [] });
  });

  it("recusa parâmetros inválidos", async () => {
    expect((await call("")).status).toBe(400);
    expect((await call("?category=noticias&page=0")).status).toBe(400);
    expect((await call("?category=noticias&page=abc")).status).toBe(400);
    expect((await call("?page=2")).status).toBe(400);
  });

  it("404 quando a categoria não existe", async () => {
    getCachedCategoryBySlug.mockResolvedValue({ success: true, data: null });
    expect((await call("?category=nada&page=2")).status).toBe(404);
  });

  it("visitante sem sessão: o carregador recebe viewerIsAuthenticated=false (só públicas)", async () => {
    const response = await call("?category=noticias&page=2");
    expect(response.status).toBe(200);
    expect(loadCategoryEntries).toHaveBeenCalledWith(expect.objectContaining({ page: 2, viewerIsAuthenticated: false }));
  });

  it("repassa ?tipo= válido ao carregador e ignora formato inválido", async () => {
    await call("?category=noticias&page=2&tipo=campanhas");
    expect(loadCategoryEntries).toHaveBeenLastCalledWith(expect.objectContaining({ typeKey: "campanhas" }));
    await call("?category=noticias&page=2&tipo=..%2Fx");
    expect(loadCategoryEntries).toHaveBeenLastCalledWith(expect.objectContaining({ typeKey: null }));
    await call("?category=noticias&page=2");
    expect(loadCategoryEntries).toHaveBeenLastCalledWith(expect.objectContaining({ typeKey: null }));
  });

  it("com sessão: viewerIsAuthenticated=true", async () => {
    getCurrentUser.mockResolvedValue({ success: true, data: { id: "u1" } });
    await call("?category=noticias&page=3");
    expect(loadCategoryEntries).toHaveBeenCalledWith(expect.objectContaining({ page: 3, viewerIsAuthenticated: true }));
  });

  it("resposta é privada (varia por sessão) e traz o lote", async () => {
    loadCategoryEntries.mockResolvedValue({ entries: [{ id: "e1" }], hasNextPage: true, records: [] });
    const response = await call("?category=noticias&page=2");
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(await response.json()).toEqual({ entries: [{ id: "e1" }], hasNextPage: true });
  });
});
