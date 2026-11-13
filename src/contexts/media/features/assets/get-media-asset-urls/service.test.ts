import { beforeEach, describe, expect, it, vi } from "vitest";

const findAssetUrlsByIds = vi.fn();
vi.mock("./store", () => ({ findAssetUrlsByIds: (...args: unknown[]) => findAssetUrlsByIds(...args) }));

const ROWS = [
  { id: "pub", url: "https://blob/pub.png", visibility: "public", uploadedBy: "someone", accessPermission: null },
  { id: "mine", url: "/api/media/asset/mine", visibility: "private", uploadedBy: "me", accessPermission: null },
  { id: "other", url: "/api/media/asset/other", visibility: "restricted", uploadedBy: "someone", accessPermission: "vagas.applications.review" },
];

describe("getMediaAssetUrls", () => {
  beforeEach(() => findAssetUrlsByIds.mockReset().mockResolvedValue(ROWS));

  it("returns only public urls to anonymous visitors, in one query", async () => {
    const { getMediaAssetUrls } = await import("./service");
    const result = await getMediaAssetUrls({ ids: ["pub", "mine", "other", "pub"] }, null);
    expect(result).toEqual({ success: true, data: { pub: "https://blob/pub.png" } });
    expect(findAssetUrlsByIds).toHaveBeenCalledTimes(1);
    expect(findAssetUrlsByIds).toHaveBeenCalledWith(["pub", "mine", "other"]);
  });

  it("adds the actor's own assets, and private ones for media admins — but not restricted", async () => {
    const { getMediaAssetUrls } = await import("./service");
    const own = await getMediaAssetUrls({ ids: ["pub", "mine", "other"] }, { actorId: "me", isMediaAdmin: false, isSuperadmin: false, permissions: [] });
    const admin = await getMediaAssetUrls({ ids: ["pub", "mine", "other"] }, { actorId: "x", isMediaAdmin: true, isSuperadmin: false, permissions: ["media.manage"] });
    expect(Object.keys(own.success ? own.data : {})).toEqual(["pub", "mine"]);
    expect(Object.keys(admin.success ? admin.data : {})).toEqual(["pub", "mine"]);
  });

  it("libera o restrito pra quem tem a permission do asset e pro superadmin", async () => {
    const { getMediaAssetUrls } = await import("./service");
    const rh = await getMediaAssetUrls({ ids: ["other"] }, { actorId: "rh", isMediaAdmin: false, isSuperadmin: false, permissions: ["vagas.applications.review"] });
    const root = await getMediaAssetUrls({ ids: ["other"] }, { actorId: "root", isMediaAdmin: true, isSuperadmin: true, permissions: [] });
    expect(Object.keys(rh.success ? rh.data : {})).toContain("other");
    expect(Object.keys(root.success ? root.data : {})).toContain("other");
  });

  it("getMediaAssetImages devolve url + dimensões do original, com o mesmo recorte de visibilidade", async () => {
    findAssetUrlsByIds.mockResolvedValue([
      { ...ROWS[0], width: 1080, height: 1350 },
      { ...ROWS[1], width: null, height: null },
      ROWS[2],
    ]);
    const { getMediaAssetImages } = await import("./service");
    const result = await getMediaAssetImages({ ids: ["pub", "mine", "other"] }, null);
    expect(result).toEqual({ success: true, data: { pub: { url: "https://blob/pub.png", width: 1080, height: 1350 } } });
  });

  it("skips the query for an empty list", async () => {
    const { getMediaAssetUrls } = await import("./service");
    expect(await getMediaAssetUrls({ ids: [] }, null)).toEqual({ success: true, data: {} });
    expect(findAssetUrlsByIds).not.toHaveBeenCalled();
  });
});
