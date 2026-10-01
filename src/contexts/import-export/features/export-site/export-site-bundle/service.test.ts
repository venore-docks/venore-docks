import { beforeEach, describe, expect, it, vi } from "vitest";

const listContentTypes = vi.fn();
const listCmsCategories = vi.fn();
const listEntriesForAdmin = vi.fn();
const listMenus = vi.fn();
const getMenuTree = vi.fn();
const extractEntryComposition = vi.fn();

vi.mock("@/contexts/cms", () => ({
  listContentTypes: (...args: unknown[]) => listContentTypes(...args),
  listCategories: (...args: unknown[]) => listCmsCategories(...args),
  listEntriesForAdmin: (...args: unknown[]) => listEntriesForAdmin(...args),
  listMenus: (...args: unknown[]) => listMenus(...args),
  getMenuTree: (...args: unknown[]) => getMenuTree(...args),
  extractEntryComposition: (...args: unknown[]) => extractEntryComposition(...args),
}));

const listMediaCategories = vi.fn();
const listMediaAssets = vi.fn();
const readMediaAsset = vi.fn();

vi.mock("@/contexts/media", () => ({
  listCategories: (...args: unknown[]) => listMediaCategories(...args),
  listMediaAssets: (...args: unknown[]) => listMediaAssets(...args),
  readMediaAsset: (...args: unknown[]) => readMediaAsset(...args),
}));

const listUsers = vi.fn();

vi.mock("@/contexts/auth", () => ({
  listUsers: (...args: unknown[]) => listUsers(...args),
}));

describe("exportSiteBundle", () => {
  beforeEach(() => {
    listContentTypes.mockReset();
    listCmsCategories.mockReset();
    listEntriesForAdmin.mockReset();
    listMenus.mockReset();
    getMenuTree.mockReset();
    extractEntryComposition.mockReset().mockReturnValue(null);
    listMediaCategories.mockReset();
    listMediaAssets.mockReset();
    listUsers.mockReset();
    readMediaAsset.mockReset().mockImplementation(async () => ({
      success: true,
      data: { body: new Blob(["fake-bytes"]).stream(), size: 10, contentType: "image/png", range: null, visibility: "public" },
    }));
  });

  it("builds a manifest that references entries/categories/media by key/checksum, never by database id", async () => {
    listContentTypes.mockResolvedValue({ success: true, data: [{ id: "ct1", key: "news", name: "News", description: null }] });
    listCmsCategories.mockResolvedValue({ success: true, data: [{ id: "cat1", key: "blog", slug: "blog", name: "Blog", description: null }] });
    listEntriesForAdmin.mockResolvedValue({
      success: true,
      data: [
        {
          id: "e1",
          contentTypeIds: ["ct1"],
          categoryId: "cat1",
          title: "Hello",
          slug: "hello",
          status: "published",
          scheduledPublishAt: null,
          scheduledArchiveAt: null,
          visibility: "public",
          viewCount: 0,
          data: { body: "hi" },
          mediaId: "m1",
          authorId: "u1",
          publishedAt: new Date("2024-01-01T00:00:00.000Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    listMenus.mockResolvedValue({
      success: true,
      data: [{ id: "menu1", key: "main", name: "Main", location: "main", scopePath: null, createdAt: new Date(), updatedAt: new Date() }],
    });
    getMenuTree.mockResolvedValue({
      success: true,
      data: {
        menu: { id: "menu1", key: "main", name: "Main", location: "main", scopePath: null },
        items: [
          {
            id: "mi1",
            menuId: "menu1",
            parentId: null,
            label: "Home",
            order: 0,
            isVisible: true,
            icon: null,
            targetType: "content",
            contentId: "e1",
            resolvedHref: "/blog/hello",
            contentTitle: "Hello",
            status: "active",
            reason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            children: [],
          },
        ],
      },
    });
    listMediaCategories.mockResolvedValue({ success: true, data: [{ id: "mc1", key: "photos", name: "Photos", createdAt: new Date() }] });
    listMediaAssets.mockResolvedValue({
      success: true,
      data: [
        {
          id: "m1",
          filename: "pic.png",
          pathname: "abc-pic.png",
          url: "https://example.com/pic.png",
          contentType: "image/png",
          size: 123,
          width: 10,
          height: 10,
          alt: null,
          checksum: "abc123",
          uploadedBy: "u1",
          visibility: "public",
          categoryId: "mc1",
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    listUsers.mockResolvedValue({ success: true, data: [{ id: "u1", name: "Ana", email: "ana@example.com", status: "approved" }] });

    const { exportSiteBundle } = await import("./service");
    const result = await exportSiteBundle();

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { manifest, files } = result.data;

    expect(manifest.entries).toEqual([
      expect.objectContaining({
        ref: "blog/hello",
        categoryKey: "blog",
        tagKeys: ["news"],
        mediaRef: "abc123",
        authorEmail: "ana@example.com",
        status: "published",
      }),
    ]);
    expect(manifest.menus[0].items[0]).toEqual(
      expect.objectContaining({ contentRef: "blog/hello", targetType: "content", parentExportId: null }),
    );
    expect(manifest.mediaAssets[0]).toEqual(expect.objectContaining({ ref: "abc123", categoryName: "Photos", file: "assets/abc123-pic.png" }));
    expect(files).toEqual([{ path: "assets/abc123-pic.png", data: expect.any(Buffer) }]);
  });

  it("reads media through the media barrel and skips an unreadable file without failing the export", async () => {
    listContentTypes.mockResolvedValue({ success: true, data: [] });
    listCmsCategories.mockResolvedValue({ success: true, data: [] });
    listEntriesForAdmin.mockResolvedValue({ success: true, data: [] });
    listMenus.mockResolvedValue({ success: true, data: [] });
    listMediaCategories.mockResolvedValue({ success: true, data: [] });
    listUsers.mockResolvedValue({ success: true, data: [] });
    const asset = (id: string, checksum: string) => ({
      id,
      filename: `${id}.pdf`,
      pathname: `${id}.pdf`,
      url: `/api/media/asset/${id}`,
      contentType: "application/pdf",
      size: 10,
      width: null,
      height: null,
      alt: null,
      checksum,
      uploadedBy: null,
      visibility: "private",
      categoryId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    listMediaAssets.mockResolvedValue({ success: true, data: [asset("ok", "c-ok"), asset("gone", "c-gone")] });
    readMediaAsset.mockImplementation(async ({ id }: { id: string }) =>
      id === "gone"
        ? { success: false, error: { code: "media.not_found", message: "Arquivo não encontrado." } }
        : { success: true, data: { body: new Blob(["pdf"]).stream(), size: 3, contentType: "application/pdf", range: null, visibility: "private" } },
    );

    const { exportSiteBundle } = await import("./service");
    const result = await exportSiteBundle();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(readMediaAsset).toHaveBeenCalledWith({ id: "ok" });
    expect(result.data.manifest.mediaAssets.map((item) => item.ref)).toEqual(["c-ok", "c-gone"]);
    expect(result.data.files.map((file) => file.path)).toEqual(["assets/c-ok-ok.pdf"]);
    expect(result.data.files[0].data.toString()).toBe("pdf");
    expect(result.data.manifest.skippedAssets).toEqual([{ ref: "c-gone", filename: "gone.pdf", reason: "Arquivo não encontrado." }]);
  });

  it("propagates a failure from any of the underlying reads instead of building a partial manifest", async () => {
    listContentTypes.mockResolvedValue({ success: false, error: { code: "boom", message: "failed" } });

    const { exportSiteBundle } = await import("./service");
    const result = await exportSiteBundle();

    expect(result).toEqual({ success: false, error: { code: "boom", message: "failed" } });
  });
});
