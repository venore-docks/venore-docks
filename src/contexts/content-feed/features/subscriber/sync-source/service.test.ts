import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const findSourceById = vi.fn();
const updateSourceSyncState = vi.fn();
const upsertArticles = vi.fn();

vi.mock("./store", () => ({
  findSourceById: (...args: unknown[]) => findSourceById(...args),
  updateSourceSyncState: (...args: unknown[]) => updateSourceSyncState(...args),
  upsertArticles: (...args: unknown[]) => upsertArticles(...args),
}));

const baseSource = {
  id: "source-1",
  name: "Portal do Colaborador",
  remoteUrl: "https://portal.erasto.com.br",
  connectionKey: "the-key",
  categoryKeys: [] as string[],
  lastSyncedAt: null,
  lastSyncError: null,
  createdAt: new Date("2026-01-01"),
};

describe("syncSource", () => {
  beforeEach(() => {
    findSourceById.mockReset();
    updateSourceSyncState.mockReset();
    upsertArticles.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns not_found when the source does not exist, without calling fetch", async () => {
    findSourceById.mockResolvedValue(null);

    const { syncSource } = await import("./service");
    const result = await syncSource({ id: "missing", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "content-feed.sources.not_found", message: expect.any(String) },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the connection key as X-Feed-Key and upserts the returned articles", async () => {
    findSourceById.mockResolvedValue(baseSource);
    const article = {
      ref: "entry-1",
      title: "Título",
      excerptText: "Resumo",
      coverImageUrl: null,
      categoryKey: "noticias",
      entrySlug: "titulo",
      categorySlug: "noticias",
      publishedAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ articles: [article] }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    const { syncSource } = await import("./service");
    const result = await syncSource({ id: "source-1", actorId: "actor-1" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>)["X-Feed-Key"]).toBe("the-key");
    expect(upsertArticles).toHaveBeenCalledWith("source-1", [article]);
    expect(updateSourceSyncState).toHaveBeenCalledWith("source-1", { lastSyncedAt: expect.any(Date), lastSyncError: null });
    expect(result).toEqual({ success: true, data: { syncedCount: 1, error: null } });
  });

  it("only keeps articles matching the source's own categoryKeys when it has any set", async () => {
    findSourceById.mockResolvedValue({ ...baseSource, categoryKeys: ["noticias"] });
    const wanted = { ref: "a", title: "A", excerptText: null, coverImageUrl: null, categoryKey: "noticias", entrySlug: "a", categorySlug: "noticias", publishedAt: null, updatedAt: "2026-01-02T00:00:00.000Z" };
    const unwanted = { ...wanted, ref: "b", categoryKey: "eventos" };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ articles: [wanted, unwanted] }), { status: 200 }));

    const { syncSource } = await import("./service");
    const result = await syncSource({ id: "source-1", actorId: "actor-1" });

    expect(upsertArticles).toHaveBeenCalledWith("source-1", [wanted]);
    expect(result).toEqual({ success: true, data: { syncedCount: 1, error: null } });
  });

  it("never throws on a network failure — records lastSyncError and still returns success:true", async () => {
    findSourceById.mockResolvedValue(baseSource);
    vi.mocked(fetch).mockRejectedValue(new Error("fetch failed"));

    const { syncSource } = await import("./service");
    const result = await syncSource({ id: "source-1", actorId: "actor-1" });

    expect(upsertArticles).not.toHaveBeenCalled();
    expect(updateSourceSyncState).toHaveBeenCalledWith("source-1", { lastSyncError: "fetch failed" });
    expect(result).toEqual({ success: true, data: { syncedCount: 0, error: "fetch failed" } });
  });

  it("treats a non-2xx response as a sync failure, not an exception", async () => {
    findSourceById.mockResolvedValue(baseSource);
    vi.mocked(fetch).mockResolvedValue(new Response("forbidden", { status: 403 }));

    const { syncSource } = await import("./service");
    const result = await syncSource({ id: "source-1", actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(result).toEqual({ success: true, data: { syncedCount: 0, error: expect.stringContaining("403") } });
    expect(updateSourceSyncState).toHaveBeenCalledWith("source-1", { lastSyncError: expect.stringContaining("403") });
  });
});
