import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const invalidateCacheByPrefix = vi.fn();
vi.mock("@/infrastructure/cache/memory-cache", () => ({
  invalidateCacheByPrefix: (...args: unknown[]) => invalidateCacheByPrefix(...args),
}));

const findMenuByKey = vi.fn();
const findMenuByLocation = vi.fn();
const findMenuByScopePath = vi.fn();
const insertMenu = vi.fn();

vi.mock("./store", () => ({
  findMenuByKey: (...args: unknown[]) => findMenuByKey(...args),
  findMenuByLocation: (...args: unknown[]) => findMenuByLocation(...args),
  findMenuByScopePath: (...args: unknown[]) => findMenuByScopePath(...args),
  insertMenu: (...args: unknown[]) => insertMenu(...args),
}));

describe("createMenu", () => {
  beforeEach(() => {
    findMenuByKey.mockReset().mockResolvedValue(null);
    findMenuByLocation.mockReset().mockResolvedValue(null);
    findMenuByScopePath.mockReset().mockResolvedValue(null);
    insertMenu.mockReset();
    invalidateCacheByPrefix.mockReset();
  });

  it("creates a singleton-location menu and invalidates the navigation cache", async () => {
    insertMenu.mockResolvedValue({ id: "menu-1", key: "main", name: "Principal", location: "main", scopePath: null });

    const { createMenu } = await import("./service");
    const result = await createMenu({ key: "main", name: "Principal", location: "main", actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith("cms:navigation");
  });

  it("rejects a second menu for a singleton location (main/header/sitemap)", async () => {
    findMenuByLocation.mockResolvedValue({ id: "existing", key: "main", name: "Principal", location: "main", scopePath: null });

    const { createMenu } = await import("./service");
    const result = await createMenu({ key: "main-2", name: "Principal 2", location: "main", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.menus.location_taken", message: expect.any(String) },
    });
    expect(insertMenu).not.toHaveBeenCalled();
  });

  it("requires a scopePath for contextual menus", async () => {
    const { createMenu } = await import("./service");
    const result = await createMenu({ key: "ctx-1", name: "Academy", location: "contextual", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.menus.scope_path_required", message: expect.any(String) },
    });
    expect(insertMenu).not.toHaveBeenCalled();
  });

  it("rejects a duplicate scopePath among contextual menus", async () => {
    findMenuByScopePath.mockResolvedValue({ id: "existing", key: "academy", name: "Academy", location: "contextual", scopePath: "/academy" });

    const { createMenu } = await import("./service");
    const result = await createMenu({
      key: "academy-2",
      name: "Academy 2",
      location: "contextual",
      scopePath: "/academy",
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "cms.menus.scope_path_taken", message: expect.any(String) },
    });
  });

  it("allows unlimited contextual menus as long as scopePath differs", async () => {
    insertMenu.mockResolvedValue({ id: "menu-2", key: "academy", name: "Academy", location: "contextual", scopePath: "/academy" });

    const { createMenu } = await import("./service");
    const result = await createMenu({
      key: "academy",
      name: "Academy",
      location: "contextual",
      scopePath: "/academy",
      actorId: "actor-1",
    });

    expect(result.success).toBe(true);
    expect(findMenuByLocation).not.toHaveBeenCalled();
  });

  it.each([
    ["/RH/", "/rh"],
    ["rh", "/rh"],
    ["  /Notícias// ", "/notícias"],
    ["/not%C3%ADcias", "/notícias"],
  ])("normalizes contextual scopePath %j to %j before checking and inserting (B2)", async (input, expected) => {
    insertMenu.mockResolvedValue({ id: "menu-1", key: "ctx", name: "Ctx", location: "contextual", scopePath: expected });

    const { createMenu } = await import("./service");
    const result = await createMenu({ key: "ctx", name: "Ctx", location: "contextual", scopePath: input, actorId: "actor-1" });

    expect(result.success).toBe(true);
    expect(findMenuByScopePath).toHaveBeenCalledWith(expected);
    expect(insertMenu).toHaveBeenCalledWith(expect.objectContaining({ scopePath: expected }));
  });
});
