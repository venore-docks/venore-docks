import { beforeEach, describe, expect, it, vi } from "vitest";

const listCategories = vi.fn();
const listEntries = vi.fn();
vi.mock("@/contexts/cms", () => ({
  listCategories: (...args: unknown[]) => listCategories(...args),
  listEntries: (...args: unknown[]) => listEntries(...args),
}));

const entry = (id: string, slug: string, categoryId: string | null) => ({ id, slug, categoryId });

describe("listPublicEntryLinks", () => {
  beforeEach(() => {
    listCategories.mockReset().mockResolvedValue({ success: true, data: [{ id: "c1", slug: "blog", name: "Blog" }] });
    listEntries.mockReset().mockResolvedValue({
      success: true,
      data: [entry("e1", "ola", "c1"), entry("e2", "sobre", null), entry("e3", "home", null), entry("e4", "orfa", "apagada")],
    });
  });

  it("asks only for public content and builds public paths, skipping /home and orphan entries", async () => {
    const { listPublicEntryLinks } = await import("./public-content");
    const { entries } = await listPublicEntryLinks();
    expect(listEntries).toHaveBeenCalledWith({ visibility: "public" });
    expect(entries.map((link) => link.path)).toEqual(["/blog/ola", "/sobre"]);
  });

  it("filters by category slug and returns nothing for an unknown one", async () => {
    const { listPublicEntryLinks } = await import("./public-content");
    await listPublicEntryLinks({ categorySlug: "blog", limit: 5 });
    expect(listEntries).toHaveBeenCalledWith({ visibility: "public", categoryId: "c1", limit: 5 });
    expect((await listPublicEntryLinks({ categorySlug: "nada" })).entries).toEqual([]);
  });
});
