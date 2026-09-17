import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const invalidateCacheByPrefix = vi.fn();
vi.mock("@/infrastructure/cache/memory-cache", () => ({
  invalidateCacheByPrefix: (...args: unknown[]) => invalidateCacheByPrefix(...args),
}));

const findMenuById = vi.fn();
const findMenuItemsByMenuId = vi.fn();
const findEntryExists = vi.fn();
const insertMenuItem = vi.fn();

vi.mock("./store", () => ({
  findMenuById: (...args: unknown[]) => findMenuById(...args),
  findMenuItemsByMenuId: (...args: unknown[]) => findMenuItemsByMenuId(...args),
  findEntryExists: (...args: unknown[]) => findEntryExists(...args),
  insertMenuItem: (...args: unknown[]) => insertMenuItem(...args),
}));

function item(id: string, parentId: string | null, order = 0) {
  return { id, menuId: "menu-1", parentId, label: id, order, isVisible: true, targetType: "label" as const };
}

describe("createMenuItem", () => {
  beforeEach(() => {
    findMenuById.mockReset().mockResolvedValue({ id: "menu-1", key: "main", name: "Principal", location: "main", scopePath: null });
    findMenuItemsByMenuId.mockReset().mockResolvedValue([]);
    findEntryExists.mockReset().mockResolvedValue(true);
    insertMenuItem.mockReset();
    invalidateCacheByPrefix.mockReset();
  });

  it("creates a root label item and invalidates the navigation cache", async () => {
    insertMenuItem.mockResolvedValue(item("new-item", null));

    const { createMenuItem } = await import("./service");
    const result = await createMenuItem({
      menuId: "menu-1",
      label: "Institucional",
      target: { targetType: "label" },
      actorId: "actor-1",
    });

    expect(result.success).toBe(true);
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith("cms:navigation");
  });

  it("passes the chosen icon through to insertMenuItem, and defaults to null when omitted", async () => {
    insertMenuItem.mockResolvedValue(item("new-item", null));

    const { createMenuItem } = await import("./service");
    await createMenuItem({
      menuId: "menu-1",
      label: "Institucional",
      target: { targetType: "label" },
      icon: "folder-tree",
      actorId: "actor-1",
    });

    expect(insertMenuItem).toHaveBeenCalledWith(expect.objectContaining({ icon: "folder-tree" }));

    insertMenuItem.mockClear();
    insertMenuItem.mockResolvedValue(item("new-item-2", null));

    await createMenuItem({
      menuId: "menu-1",
      label: "Institucional",
      target: { targetType: "label" },
      actorId: "actor-1",
    });

    expect(insertMenuItem).toHaveBeenCalledWith(expect.objectContaining({ icon: null }));
  });

  it("rejects a content item pointing at a content id that does not exist", async () => {
    findEntryExists.mockResolvedValue(false);

    const { createMenuItem } = await import("./service");
    const result = await createMenuItem({
      menuId: "menu-1",
      label: "Sobre",
      target: { targetType: "content", contentId: "missing-entry", anchor: null },
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.menus.content_not_found", message: expect.any(String) },
    });
    expect(insertMenuItem).not.toHaveBeenCalled();
  });

  it("rejects creation under a depth that would exceed MAX_MENU_ITEM_DEPTH", async () => {
    // Cadeia já no limite: a-b-c-d (profundidade 4). Um filho de "d" seria profundidade 5.
    findMenuItemsByMenuId.mockResolvedValue([
      item("a", null),
      item("b", "a"),
      item("c", "b"),
      item("d", "c"),
    ]);

    const { createMenuItem } = await import("./service");
    const result = await createMenuItem({
      menuId: "menu-1",
      label: "Neto demais",
      parentId: "d",
      target: { targetType: "label" },
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.menus.max_depth_exceeded", message: expect.any(String) },
    });
    expect(insertMenuItem).not.toHaveBeenCalled();
  });

  it("allows creation exactly at MAX_MENU_ITEM_DEPTH", async () => {
    findMenuItemsByMenuId.mockResolvedValue([item("a", null), item("b", "a"), item("c", "b")]);
    insertMenuItem.mockResolvedValue(item("d", "c"));

    const { createMenuItem } = await import("./service");
    const result = await createMenuItem({
      menuId: "menu-1",
      label: "No limite",
      parentId: "c",
      target: { targetType: "label" },
      actorId: "actor-1",
    });

    expect(result.success).toBe(true);
  });
});
