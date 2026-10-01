import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/cache/memory-cache", async () => {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    getCache: (key: string) => {
      const entry = store.get(key);
      if (!entry || Date.now() > entry.expiresAt) return null;
      return entry.value;
    },
    setCache: (key: string, value: unknown, ttlSeconds: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    invalidateCacheByPrefix: (prefix: string) => {
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
      }
    },
    __store: store,
  };
});

const getActorPermissionKeys = vi.fn();
vi.mock("../../../actor-permission-keys", () => ({
  getActorPermissionKeys: (...args: unknown[]) => getActorPermissionKeys(...args),
}));

const findContextualMenus = vi.fn();
const findMenuItemsByMenuId = vi.fn();
const findEntryRouteInfoByIds = vi.fn();

vi.mock("./store", () => ({
  findContextualMenus: (...args: unknown[]) => findContextualMenus(...args),
  findMenuItemsByMenuId: (...args: unknown[]) => findMenuItemsByMenuId(...args),
  findEntryRouteInfoByIds: (...args: unknown[]) => findEntryRouteInfoByIds(...args),
}));

describe("findLongestScopeMatch", () => {
  it("picks the longest matching scopePath prefix, not the first candidate", async () => {
    const { findLongestScopeMatch } = await import("./service");
    const candidates = [
      { id: "menu-academy", scopePath: "/academy" },
      { id: "menu-academy-courses", scopePath: "/academy/courses" },
    ];

    expect(findLongestScopeMatch(candidates, "/academy/courses/123")?.id).toBe("menu-academy-courses");
    expect(findLongestScopeMatch(candidates, "/academy/about")?.id).toBe("menu-academy");
  });

  it("does not match a path that merely shares a prefix without a segment boundary", async () => {
    const { findLongestScopeMatch } = await import("./service");
    const candidates = [{ id: "menu-academy", scopePath: "/academy" }];

    expect(findLongestScopeMatch(candidates, "/academyfoo")).toBeUndefined();
  });

  it("returns undefined when nothing matches", async () => {
    const { findLongestScopeMatch } = await import("./service");
    expect(findLongestScopeMatch([{ id: "menu-academy", scopePath: "/academy" }], "/blog/post")).toBeUndefined();
  });
});

describe("findLongestScopeMatch normalization (B2)", () => {
  it.each([
    ["/rh/", "/rh"],
    ["rh", "/rh"],
    ["/RH", "/rh"],
    ["/rh", "/RH/"],
    ["/notícias", "/not%C3%ADcias"],
    ["/not%C3%ADcias", "/notícias/post"],
    ["/Notícias", "/not%C3%ADcias"],
  ])("scopePath %j matches pathname %j", async (scopePath, pathname) => {
    const { findLongestScopeMatch } = await import("./service");
    expect(findLongestScopeMatch([{ id: "m", scopePath }], pathname)?.id).toBe("m");
  });

  it("still respects segment boundaries after normalization", async () => {
    const { findLongestScopeMatch } = await import("./service");
    expect(findLongestScopeMatch([{ id: "m", scopePath: "/rh/" }], "/rhx")).toBeUndefined();
  });

  it("ranks by normalized length (a trailing slash does not make a scope longer)", async () => {
    const { findLongestScopeMatch } = await import("./service");
    const candidates = [
      { id: "short", scopePath: "/academy////" },
      { id: "long", scopePath: "/academy/c" },
    ];
    expect(findLongestScopeMatch(candidates, "/academy/c/1")?.id).toBe("long");
  });
});

describe("getContextualMenu", () => {
  beforeEach(async () => {
    findContextualMenus.mockReset();
    findMenuItemsByMenuId.mockReset();
    findEntryRouteInfoByIds.mockReset().mockResolvedValue(new Map());
    getActorPermissionKeys.mockReset().mockResolvedValue(new Set());
    const cache = (await import("@/infrastructure/cache/memory-cache")) as unknown as { __store: Map<string, unknown> };
    cache.__store.clear();
  });

  it("returns no navigation (not the main menu) when no contextual menu matches the path", async () => {
    findContextualMenus.mockResolvedValue([{ id: "menu-academy", scopePath: "/academy" }]);

    const { getContextualMenu } = await import("./service");
    const result = await getContextualMenu({ path: "/blog/post-1" });

    expect(result).toEqual({ success: true, data: [] });
    expect(findMenuItemsByMenuId).not.toHaveBeenCalled();
  });

  it("resolves the deepest-matching contextual menu's items", async () => {
    findContextualMenus.mockResolvedValue([
      { id: "menu-academy", scopePath: "/academy" },
      { id: "menu-academy-courses", scopePath: "/academy/courses" },
    ]);
    findMenuItemsByMenuId.mockImplementation(async (menuId: string) =>
      menuId === "menu-academy-courses"
        ? [
            {
              id: "item-1",
              menuId: "menu-academy-courses",
              parentId: null,
              label: "Todos os cursos",
              order: 0,
              isVisible: true,
              targetType: "route",
              routePath: "/academy/courses",
              requiredPermissionKey: null,
            },
          ]
        : [],
    );

    const { getContextualMenu } = await import("./service");
    const result = await getContextualMenu({ path: "/academy/courses/123" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ href: "/academy/courses" });
    }
    expect(findMenuItemsByMenuId).toHaveBeenCalledWith("menu-academy-courses");
  });
});
