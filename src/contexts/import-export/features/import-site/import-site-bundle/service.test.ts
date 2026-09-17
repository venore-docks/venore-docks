import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const archiveEntry = vi.fn();
const createCmsCategory = vi.fn();
const createContentType = vi.fn();
const createEntry = vi.fn();
const createMenu = vi.fn();
const createMenuItem = vi.fn();
const listCmsCategories = vi.fn();
const listContentTypes = vi.fn();
const listEntriesForAdmin = vi.fn();
const listMenus = vi.fn();
const publishEntry = vi.fn();
const scheduleEntry = vi.fn();
const updateEntry = vi.fn();
const updateMenuItem = vi.fn();
const extractEntryComposition = vi.fn();

vi.mock("@/contexts/cms", () => ({
  archiveEntry: (...args: unknown[]) => archiveEntry(...args),
  createCategory: (...args: unknown[]) => createCmsCategory(...args),
  createContentType: (...args: unknown[]) => createContentType(...args),
  createEntry: (...args: unknown[]) => createEntry(...args),
  createMenu: (...args: unknown[]) => createMenu(...args),
  createMenuItem: (...args: unknown[]) => createMenuItem(...args),
  listCategories: (...args: unknown[]) => listCmsCategories(...args),
  listContentTypes: (...args: unknown[]) => listContentTypes(...args),
  listEntriesForAdmin: (...args: unknown[]) => listEntriesForAdmin(...args),
  listMenus: (...args: unknown[]) => listMenus(...args),
  publishEntry: (...args: unknown[]) => publishEntry(...args),
  scheduleEntry: (...args: unknown[]) => scheduleEntry(...args),
  updateEntry: (...args: unknown[]) => updateEntry(...args),
  updateMenuItem: (...args: unknown[]) => updateMenuItem(...args),
  extractEntryComposition: (...args: unknown[]) => extractEntryComposition(...args),
}));

const createMediaCategory = vi.fn();
const listMediaCategories = vi.fn();
const listMediaAssets = vi.fn();
const uploadMediaAsset = vi.fn();

vi.mock("@/contexts/media", () => ({
  createCategory: (...args: unknown[]) => createMediaCategory(...args),
  listCategories: (...args: unknown[]) => listMediaCategories(...args),
  listMediaAssets: (...args: unknown[]) => listMediaAssets(...args),
  uploadMediaAsset: (...args: unknown[]) => uploadMediaAsset(...args),
}));

const listUsers = vi.fn();

vi.mock("@/contexts/auth", () => ({
  listUsers: (...args: unknown[]) => listUsers(...args),
}));

function emptyDestination() {
  listMediaCategories.mockResolvedValue({ success: true, data: [] });
  listMediaAssets.mockResolvedValue({ success: true, data: [] });
  listContentTypes.mockResolvedValue({ success: true, data: [] });
  listCmsCategories.mockResolvedValue({ success: true, data: [] });
  listEntriesForAdmin.mockResolvedValue({ success: true, data: [] });
  listMenus.mockResolvedValue({ success: true, data: [] });
  listUsers.mockResolvedValue({ success: true, data: [] });
}

const resolveDefinition = () => null;

describe("importSiteBundle", () => {
  beforeEach(() => {
    for (const mockFn of [
      archiveEntry,
      createCmsCategory,
      createContentType,
      createEntry,
      createMenu,
      createMenuItem,
      listCmsCategories,
      listContentTypes,
      listEntriesForAdmin,
      listMenus,
      publishEntry,
      scheduleEntry,
      updateEntry,
      updateMenuItem,
      createMediaCategory,
      listMediaCategories,
      listMediaAssets,
      uploadMediaAsset,
      listUsers,
    ]) {
      mockFn.mockReset();
    }
    extractEntryComposition.mockReset().mockReturnValue(null);
  });

  it("rejects a manifest that doesn't match the expected shape, before touching any destination data", async () => {
    const { importSiteBundle } = await import("./service");

    const result = await importSiteBundle({ manifest: { foo: "bar" }, files: new Map(), actorId: "actor-1", resolveDefinition });

    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "import-export.invalid_manifest" }) });
    expect(listContentTypes).not.toHaveBeenCalled();
  });

  it("creates media asset, tag, category, published entry, menu and menu item into an empty destination", async () => {
    emptyDestination();

    uploadMediaAsset.mockResolvedValue({ success: true, data: { id: "new-media-1", checksum: "abc123" } });
    createContentType.mockResolvedValue({ success: true, data: { id: "ct-new", key: "news" } });
    createCmsCategory.mockResolvedValue({ success: true, data: { id: "cat-new", key: "blog" } });
    createEntry.mockResolvedValue({ success: true, data: { id: "entry-new", slug: "hello" } });
    publishEntry.mockResolvedValue({ success: true, data: {} });
    createMenu.mockResolvedValue({ success: true, data: { id: "menu-new", key: "main" } });
    createMenuItem.mockResolvedValue({ success: true, data: { id: "mi-new" } });

    const manifest = {
      format: "venore-import-export",
      formatVersion: 1,
      exportedAt: "2024-01-01T00:00:00.000Z",
      mediaCategories: [],
      mediaAssets: [
        {
          ref: "abc123",
          filename: "pic.png",
          contentType: "image/png",
          size: 3,
          width: null,
          height: null,
          alt: null,
          checksum: "abc123",
          visibility: "public",
          categoryName: null,
          file: "assets/abc123-pic.png",
        },
      ],
      contentTypes: [{ key: "news", name: "News", description: null }],
      categories: [{ key: "blog", slug: "blog", name: "Blog", description: null }],
      entries: [
        {
          ref: "blog/hello",
          categoryKey: "blog",
          tagKeys: ["news"],
          title: "Hello",
          slug: "hello",
          status: "published",
          scheduledPublishAt: null,
          scheduledArchiveAt: null,
          visibility: "public",
          data: { body: "hi" },
          mediaRef: "abc123",
          authorEmail: null,
          publishedAt: null,
        },
      ],
      menus: [
        {
          key: "main",
          name: "Main",
          location: "main",
          scopePath: null,
          items: [
            {
              exportId: "mi_1",
              parentExportId: null,
              label: "Home",
              order: 0,
              isVisible: true,
              icon: null,
              targetType: "content",
              contentRef: "blog/hello",
              routePath: null,
              requiredPermissionKey: null,
              externalUrl: null,
            },
          ],
        },
      ],
    };

    const files = new Map([["assets/abc123-pic.png", Buffer.from("fake-bytes")]]);

    const { importSiteBundle } = await import("./service");
    const result = await importSiteBundle({ manifest, files, actorId: "actor-1", resolveDefinition });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.createdCount).toBe(6);
    expect(result.data.failedCount).toBe(0);

    expect(uploadMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "pic.png", data: Buffer.from("fake-bytes"), categoryId: undefined }),
    );
    expect(createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ contentTypeIds: ["ct-new"], categoryId: "cat-new", mediaId: "new-media-1" }),
    );
    expect(publishEntry).toHaveBeenCalledWith({ id: "entry-new", resolveDefinition });
    expect(createMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({ menuId: "menu-new", target: { targetType: "content", contentId: "entry-new", anchor: null } }),
    );
  });

  it("skips an entity that already exists in the destination and reports it instead of failing", async () => {
    emptyDestination();
    listContentTypes.mockResolvedValue({ success: true, data: [{ id: "ct-existing", key: "news", name: "News", description: null }] });

    const manifest = {
      format: "venore-import-export",
      formatVersion: 1,
      exportedAt: "2024-01-01T00:00:00.000Z",
      mediaCategories: [],
      mediaAssets: [],
      contentTypes: [{ key: "news", name: "News", description: null }],
      categories: [],
      entries: [],
      menus: [],
    };

    const { importSiteBundle } = await import("./service");
    const result = await importSiteBundle({ manifest, files: new Map(), actorId: "actor-1", resolveDefinition });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(createContentType).not.toHaveBeenCalled();
    expect(result.data.skippedCount).toBe(1);
    expect(result.data.lines[0]).toEqual(expect.objectContaining({ kind: "content-type", ref: "news", outcome: "skipped" }));
  });
});
