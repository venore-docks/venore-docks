import { beforeEach, describe, expect, it, vi } from "vitest";

const findAssetStatRows = vi.fn();
vi.mock("./store", () => ({ findAssetStatRows: (...args: unknown[]) => findAssetStatRows(...args) }));

import { getMediaLibraryStats } from "./service";

const scope = { actorId: "stats-test-actor", isMediaAdmin: true, isSuperadmin: false, permissions: ["media.manage"] };

describe("getMediaLibraryStats", () => {
  beforeEach(() => {
    findAssetStatRows.mockReset();
  });

  it("soma contagens por categoria, tipo e visibilidade, separando arquivos sem categoria", async () => {
    findAssetStatRows.mockResolvedValue([
      { categoryId: "cat-a", kind: "image", visibility: "public", count: 3, size: 300 },
      { categoryId: "cat-a", kind: "document", visibility: "private", count: 2, size: 200 },
      { categoryId: null, kind: "image", visibility: "private", count: 4, size: 400 },
      { categoryId: "cat-b", kind: "video", visibility: "public", count: 1, size: 1000 },
    ]);

    const result = await getMediaLibraryStats(scope);

    expect(result).toEqual({
      success: true,
      data: {
        total: 10,
        uncategorized: 4,
        byCategory: { "cat-a": 5, "cat-b": 1 },
        byKind: { image: 7, video: 1, audio: 0, document: 2 },
        byVisibility: { public: 4, restricted: 0, private: 6 },
        totalSize: 1900,
      },
    });
  });
});
