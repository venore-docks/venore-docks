import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const invalidateCacheByPrefix = vi.fn();
vi.mock("@/infrastructure/cache/memory-cache", () => ({
  invalidateCacheByPrefix: (...args: unknown[]) => invalidateCacheByPrefix(...args),
}));

const storeFn = vi.fn();
vi.mock("@/infrastructure/storage", () => ({
  storagePort: { store: (...args: unknown[]) => storeFn(...args) },
}));

const insertAsset = vi.fn();
vi.mock("../upload-media-asset/store", () => ({
  insertAsset: (...args: unknown[]) => insertAsset(...args),
}));

const getOrCreateReservedCategory = vi.fn();
vi.mock("../../../get-or-create-reserved-category", () => ({
  getOrCreateReservedCategory: (...args: unknown[]) => getOrCreateReservedCategory(...args),
}));

describe("uploadAvatarMediaAsset", () => {
  beforeEach(() => {
    invalidateCacheByPrefix.mockReset();
    storeFn.mockReset();
    insertAsset.mockReset();
    getOrCreateReservedCategory.mockReset();
  });

  it("always uploads as private, in the reserved avatars category, regardless of caller intent", async () => {
    getOrCreateReservedCategory.mockResolvedValue({ id: "cat-avatars", key: "avatars", name: "Avatares" });
    storeFn.mockResolvedValue({ key: "uuid-avatar.png", url: "https://blob.test/uuid-avatar.png", size: 10 });
    insertAsset.mockResolvedValue({ id: "asset-1" });

    const { uploadAvatarMediaAsset } = await import("./service");
    const data = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("avatar-bytes")]);
    await uploadAvatarMediaAsset({ filename: "me.png", contentType: "image/png", size: data.byteLength, data, actorId: "actor-1" });

    expect(getOrCreateReservedCategory).toHaveBeenCalledWith("avatars", "Avatares");
    expect(insertAsset).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "private", categoryId: "cat-avatars", uploadedBy: "actor-1" }),
    );
  });

  it("invalidates the assets list cache after a successful upload", async () => {
    getOrCreateReservedCategory.mockResolvedValue({ id: "cat-avatars", key: "avatars", name: "Avatares" });
    storeFn.mockResolvedValue({ key: "uuid-avatar.png", url: "https://blob.test/uuid-avatar.png", size: 10 });
    insertAsset.mockResolvedValue({ id: "asset-1" });

    const { uploadAvatarMediaAsset } = await import("./service");
    await uploadAvatarMediaAsset({ filename: "me.png", contentType: "image/png", size: 10, data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), actorId: "actor-1" });

    expect(invalidateCacheByPrefix).toHaveBeenCalledWith("media:assets:");
  });
});
