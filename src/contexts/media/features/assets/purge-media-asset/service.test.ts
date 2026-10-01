import { beforeEach, describe, expect, it, vi } from "vitest";

const findVariantsByAssetIds = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []);
vi.mock("../../../shared/asset-variants-store", () => ({
  findVariantsByAssetIds: (...args: unknown[]) => findVariantsByAssetIds(...args),
}));

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const invalidateCacheByPrefix = vi.fn();
vi.mock("@/infrastructure/cache/memory-cache", () => ({
  invalidateCacheByPrefix: (...args: unknown[]) => invalidateCacheByPrefix(...args),
}));

const removeFn = vi.fn();
vi.mock("@/infrastructure/storage", () => ({
  storagePort: { remove: (...args: unknown[]) => removeFn(...args) },
}));

const findSoftDeletedAssetById = vi.fn();
const hardDeleteAssetById = vi.fn();
vi.mock("./store", () => ({
  findSoftDeletedAssetById: (...args: unknown[]) => findSoftDeletedAssetById(...args),
  hardDeleteAssetById: (...args: unknown[]) => hardDeleteAssetById(...args),
}));

describe("purgeMediaAsset", () => {
  beforeEach(() => {
    invalidateCacheByPrefix.mockReset();
    removeFn.mockReset();
    findSoftDeletedAssetById.mockReset();
    hardDeleteAssetById.mockReset();
  });

  it("refuses to purge an asset that isn't soft-deleted (or doesn't exist)", async () => {
    findSoftDeletedAssetById.mockResolvedValue(null);

    const { purgeMediaAsset } = await import("./service");
    const result = await purgeMediaAsset({ id: "asset-1", actorId: "actor-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "media.purge.not_deleted", message: expect.any(String) },
    });
    expect(removeFn).not.toHaveBeenCalled();
    expect(hardDeleteAssetById).not.toHaveBeenCalled();
    expect(invalidateCacheByPrefix).not.toHaveBeenCalled();
  });

  it("removes the blob, deletes the row for real, and invalidates the list cache", async () => {
    findSoftDeletedAssetById.mockResolvedValue({
      id: "asset-1",
      pathname: "uuid-photo.png",
      deletedAt: new Date("2026-01-01"),
    });

    const { purgeMediaAsset } = await import("./service");
    const result = await purgeMediaAsset({ id: "asset-1", actorId: "actor-1" });

    expect(result).toEqual({ success: true, data: { id: "asset-1" } });
    expect(removeFn).toHaveBeenCalledWith("uuid-photo.png");
    expect(hardDeleteAssetById).toHaveBeenCalledWith("asset-1");
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith("media:assets:");
  });

  it("removes the image variants from storage before deleting the row", async () => {
    findSoftDeletedAssetById.mockResolvedValue({ id: "asset-1", pathname: "Imagens/u-foto.jpg", deletedAt: new Date("2026-01-01") });
    findVariantsByAssetIds.mockResolvedValueOnce([{ pathname: "Imagens/u-foto.w160.webp" }, { pathname: "Imagens/u-foto.w480.webp" }]);

    const { purgeMediaAsset } = await import("./service");
    await purgeMediaAsset({ id: "asset-1", actorId: "actor-1" });

    expect(removeFn.mock.calls.map(([key]) => key)).toEqual(["Imagens/u-foto.w160.webp", "Imagens/u-foto.w480.webp", "Imagens/u-foto.jpg"]);
    expect(hardDeleteAssetById).toHaveBeenCalledWith("asset-1");
  });
});
