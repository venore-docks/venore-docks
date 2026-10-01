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
const findMenuByScopePath = vi.fn();
const updateMenuFields = vi.fn();

vi.mock("./store", () => ({
  findMenuById: (...args: unknown[]) => findMenuById(...args),
  findMenuByScopePath: (...args: unknown[]) => findMenuByScopePath(...args),
  updateMenuFields: (...args: unknown[]) => updateMenuFields(...args),
}));

describe("updateMenu", () => {
  beforeEach(() => {
    findMenuById.mockReset();
    findMenuByScopePath.mockReset().mockResolvedValue(null);
    updateMenuFields.mockReset();
    invalidateCacheByPrefix.mockReset();
  });

  it("renames a menu and invalidates the navigation cache", async () => {
    findMenuById.mockResolvedValue({ id: "menu-1", key: "main", name: "Principal", location: "main", scopePath: null });
    updateMenuFields.mockResolvedValue({ id: "menu-1", key: "main", name: "Novo nome", location: "main", scopePath: null });

    const { updateMenu } = await import("./service");
    const result = await updateMenu({ id: "menu-1", name: "Novo nome", actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith("cms:navigation");
  });

  it("rejects scopePath change on a non-contextual menu", async () => {
    findMenuById.mockResolvedValue({ id: "menu-1", key: "main", name: "Principal", location: "main", scopePath: null });

    const { updateMenu } = await import("./service");
    const result = await updateMenu({ id: "menu-1", scopePath: "/foo", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.menus.scope_path_not_allowed", message: expect.any(String) },
    });
    expect(updateMenuFields).not.toHaveBeenCalled();
  });

  it("normalizes a new contextual scopePath before the conflict check and the write (B2)", async () => {
    findMenuById.mockResolvedValue({ id: "menu-1", key: "ctx", name: "Ctx", location: "contextual", scopePath: "/academy" });
    updateMenuFields.mockResolvedValue({ id: "menu-1", key: "ctx", name: "Ctx", location: "contextual", scopePath: "/rh" });

    const { updateMenu } = await import("./service");
    const result = await updateMenu({ id: "menu-1", scopePath: "RH/", actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(findMenuByScopePath).toHaveBeenCalledWith("/rh");
    expect(updateMenuFields).toHaveBeenCalledWith("menu-1", { name: undefined, scopePath: "/rh" });
  });

  it("treats a legacy un-normalized scopePath equal to the new one as unchanged (no self-conflict)", async () => {
    findMenuById.mockResolvedValue({ id: "menu-1", key: "ctx", name: "Ctx", location: "contextual", scopePath: "/RH/" });
    updateMenuFields.mockResolvedValue({ id: "menu-1", key: "ctx", name: "Ctx", location: "contextual", scopePath: "/rh" });

    const { updateMenu } = await import("./service");
    const result = await updateMenu({ id: "menu-1", scopePath: "/rh", actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(findMenuByScopePath).not.toHaveBeenCalled();
    expect(updateMenuFields).toHaveBeenCalledWith("menu-1", { name: undefined, scopePath: "/rh" });
  });
});
