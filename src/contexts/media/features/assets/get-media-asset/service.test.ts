import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/attach-asset-variants", () => ({
  attachAssetVariants: async (assets: unknown[]) => assets,
  attachAssetVariantsToOne: async (asset: unknown) => asset,
}));

const findAssetByIdForScope = vi.fn();
const findAssetByIdUnscoped = vi.fn();

vi.mock("../../../asset-url", () => ({
  createSignedMediaUrl: (id: string) => `/api/media/asset/${id}?exp=1&sig=s`,
}));

vi.mock("./store", () => ({
  findAssetByIdForScope: (...args: unknown[]) => findAssetByIdForScope(...args),
  findAssetByIdUnscoped: (...args: unknown[]) => findAssetByIdUnscoped(...args),
}));

describe("getMediaAsset", () => {
  beforeEach(() => {
    findAssetByIdForScope.mockReset();
    findAssetByIdUnscoped.mockReset();
  });

  it("resolves through the actor scope", async () => {
    findAssetByIdForScope.mockResolvedValue({ id: "asset-1", visibility: "private" });

    const { getMediaAsset } = await import("./service");
    const result = await getMediaAsset({ id: "asset-1" }, { actorId: "actor-1", isMediaAdmin: false });

    expect(result).toEqual({ success: true, data: { id: "asset-1", visibility: "private" } });
    expect(findAssetByIdForScope).toHaveBeenCalledWith("asset-1", { actorId: "actor-1", isMediaAdmin: false });
  });
});

describe("getMediaAssetForTrustedReview", () => {
  beforeEach(() => {
    findAssetByIdForScope.mockReset();
    findAssetByIdUnscoped.mockReset();
  });

  it("bypasses visibility scoping entirely, returning a private asset owned by someone else", async () => {
    findAssetByIdUnscoped.mockResolvedValue({ id: "asset-1", visibility: "private", uploadedBy: "student-1" });

    const { getMediaAssetForTrustedReview } = await import("./service");
    const result = await getMediaAssetForTrustedReview({ id: "asset-1" });

    expect(result).toEqual({
      success: true,
      data: { id: "asset-1", visibility: "private", uploadedBy: "student-1", url: "/api/media/asset/asset-1?exp=1&sig=s" },
    });
    expect(findAssetByIdForScope).not.toHaveBeenCalled();
  });
});
