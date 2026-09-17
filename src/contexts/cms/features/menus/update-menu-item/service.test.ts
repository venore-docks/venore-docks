import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const invalidateCacheByPrefix = vi.fn();
vi.mock("@/infrastructure/cache/memory-cache", () => ({
  invalidateCacheByPrefix: (...args: unknown[]) => invalidateCacheByPrefix(...args),
}));

const findMenuItemById = vi.fn();
const findEntryExists = vi.fn();
const updateMenuItemFields = vi.fn();

vi.mock("./store", () => ({
  findMenuItemById: (...args: unknown[]) => findMenuItemById(...args),
  findEntryExists: (...args: unknown[]) => findEntryExists(...args),
  updateMenuItemFields: (...args: unknown[]) => updateMenuItemFields(...args),
}));

describe("updateMenuItem", () => {
  beforeEach(() => {
    findMenuItemById.mockReset().mockResolvedValue({ id: "item-1", menuId: "menu-1", parentId: null, label: "Antigo", order: 0, isVisible: true, targetType: "label" });
    findEntryExists.mockReset().mockResolvedValue(true);
    updateMenuItemFields.mockReset();
    invalidateCacheByPrefix.mockReset();
  });

  it("relabels an item independently of any content title", async () => {
    updateMenuItemFields.mockResolvedValue({ id: "item-1", label: "Formação" });

    const { updateMenuItem } = await import("./service");
    const result = await updateMenuItem({ id: "item-1", label: "Formação", actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(updateMenuItemFields).toHaveBeenCalledWith("item-1", { label: "Formação", isVisible: undefined });
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith("cms:navigation");
  });

  it("passes the icon through to updateMenuItemFields, including clearing it back to null", async () => {
    updateMenuItemFields.mockResolvedValue({ id: "item-1" });

    const { updateMenuItem } = await import("./service");
    await updateMenuItem({ id: "item-1", icon: "users", actorId: "actor-1" });

    expect(updateMenuItemFields).toHaveBeenCalledWith("item-1", { label: undefined, isVisible: undefined, icon: "users" });

    updateMenuItemFields.mockClear();
    await updateMenuItem({ id: "item-1", icon: null, actorId: "actor-1" });

    expect(updateMenuItemFields).toHaveBeenCalledWith("item-1", { label: undefined, isVisible: undefined, icon: null });
  });

  it("clears the other target columns when switching targetType", async () => {
    updateMenuItemFields.mockResolvedValue({ id: "item-1" });

    const { updateMenuItem } = await import("./service");
    await updateMenuItem({
      id: "item-1",
      target: { targetType: "external", externalUrl: "https://example.com" },
      actorId: "actor-1",
    });

    expect(updateMenuItemFields).toHaveBeenCalledWith("item-1", {
      label: undefined,
      isVisible: undefined,
      icon: undefined,
      targetType: "external",
      contentId: null,
      anchor: null,
      routePath: null,
      requiredPermissionKey: null,
      externalUrl: "https://example.com",
    });
  });
});
