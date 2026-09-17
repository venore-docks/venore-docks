import { beforeEach, describe, expect, it, vi } from "vitest";

const findEntryById = vi.fn();

vi.mock("./store", () => ({
  findEntryById: (...args: unknown[]) => findEntryById(...args),
}));

const baseEntry = {
  id: "entry-1",
  contentTypeId: "ct-1",
  categoryId: null,
  title: "Hello",
  slug: "hello",
  status: "draft",
  data: {},
  mediaId: null,
  authorId: "actor-1",
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getEntryComposition", () => {
  beforeEach(() => {
    findEntryById.mockReset();
  });

  it("fails when the entry does not exist", async () => {
    findEntryById.mockResolvedValue(null);

    const { getEntryComposition } = await import("./service");
    const result = await getEntryComposition({ id: "missing" });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.entries.not_found", message: expect.any(String) },
    });
  });

  it("returns null when the entry has no blocks (legacy data)", async () => {
    findEntryById.mockResolvedValue({ ...baseEntry, data: { body: "legacy" } });

    const { getEntryComposition } = await import("./service");
    const result = await getEntryComposition({ id: "entry-1" });

    expect(result).toEqual({ success: true, data: null });
  });

  it("returns the composition when data.blocks is present", async () => {
    const composition = [{ id: "b1", key: "text", slot: "main", htmlId: null, data: {}, areas: [] }];
    findEntryById.mockResolvedValue({ ...baseEntry, data: { blocks: composition } });

    const { getEntryComposition } = await import("./service");
    const result = await getEntryComposition({ id: "entry-1" });

    expect(result).toEqual({ success: true, data: composition });
  });
});
