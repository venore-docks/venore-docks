import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/attach-asset-variants", () => ({
  attachAssetVariants: async (assets: unknown[]) => assets,
  attachAssetVariantsToOne: async (asset: unknown) => asset,
}));

const resolveMediaActorScope = vi.fn();
vi.mock("../../../resolve-media-actor-scope", () => ({
  resolveMediaActorScope: (...args: unknown[]) => resolveMediaActorScope(...args),
}));

const getMediaAsset = vi.fn();
vi.mock("./service", () => ({
  getMediaAsset: (...args: unknown[]) => getMediaAsset(...args),
}));

const findPublicAssetById = vi.fn();
vi.mock("./store", () => ({
  findPublicAssetById: (...args: unknown[]) => findPublicAssetById(...args),
}));

describe("getMediaAssetHandler", () => {
  beforeEach(() => {
    resolveMediaActorScope.mockReset();
    getMediaAsset.mockReset();
    findPublicAssetById.mockReset();
  });

  it("resolves a public asset for a visitor without a session", async () => {
    resolveMediaActorScope.mockResolvedValue(null);
    findPublicAssetById.mockResolvedValue({ id: "asset-1", visibility: "public" });

    const { getMediaAssetHandler } = await import("./handler");
    const result = await getMediaAssetHandler({ id: "asset-1" });

    expect(result).toEqual({ success: true, data: { id: "asset-1", visibility: "public" } });
    expect(findPublicAssetById).toHaveBeenCalledWith("asset-1");
    expect(getMediaAsset).not.toHaveBeenCalled();
  });

  it("returns null for a visitor without a session when the asset isn't public (findPublicAssetById filters it out)", async () => {
    resolveMediaActorScope.mockResolvedValue(null);
    findPublicAssetById.mockResolvedValue(null);

    const { getMediaAssetHandler } = await import("./handler");
    const result = await getMediaAssetHandler({ id: "private-asset" });

    expect(result).toEqual({ success: true, data: null });
  });

  it("resolves through the actor scope when a session exists", async () => {
    resolveMediaActorScope.mockResolvedValue({ actorId: "actor-1", isMediaAdmin: false });
    getMediaAsset.mockResolvedValue({ success: true, data: { id: "asset-1", visibility: "private" } });

    const { getMediaAssetHandler } = await import("./handler");
    const result = await getMediaAssetHandler({ id: "asset-1" });

    expect(result).toEqual({ success: true, data: { id: "asset-1", visibility: "private" } });
    expect(getMediaAsset).toHaveBeenCalledWith({ id: "asset-1" }, { actorId: "actor-1", isMediaAdmin: false });
    expect(findPublicAssetById).not.toHaveBeenCalled();
  });
});
