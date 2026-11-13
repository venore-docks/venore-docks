import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "system", type: "system" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));
vi.mock("@/infrastructure/cache/memory-cache", () => ({ invalidateCacheByPrefix: vi.fn() }));

const store = vi.fn();
const read = vi.fn();
vi.mock("@/infrastructure/storage", () => ({
  storagePort: {
    store: (...args: unknown[]) => store(...args),
    read: (...args: unknown[]) => read(...args),
  },
}));

const findOriginalSourceAsset = vi.fn();
const updateNormalizedOriginal = vi.fn();
vi.mock("./store", () => ({
  findOriginalSourceAsset: (...args: unknown[]) => findOriginalSourceAsset(...args),
  updateNormalizedOriginal: (...args: unknown[]) => updateNormalizedOriginal(...args),
}));

const bigPhoto = () => sharp({ create: { width: 4000, height: 2000, channels: 3, background: "#336699" } }).jpeg({ quality: 98 }).toBuffer();
const smallPhoto = () => sharp({ create: { width: 800, height: 400, channels: 3, background: "#336699" } }).jpeg().toBuffer();
const readable = (data: Buffer) => ({ body: new Response(new Uint8Array(data)).body });
const source = { id: "asset-1", filename: "foto.jpg", pathname: "Imagens/u-foto.jpg", contentType: "image/jpeg" };

describe("normalizeAssetOriginal", () => {
  beforeEach(() => {
    for (const fn of [store, read, findOriginalSourceAsset, updateNormalizedOriginal]) fn.mockReset();
    store.mockImplementation(async (input: { key: string; data: Buffer }) => ({ key: input.key, url: `u/${input.key}`, size: input.data.byteLength }));
  });

  it("regrava o original reduzido NA MESMA key e atualiza tamanho, checksum e dimensões", async () => {
    findOriginalSourceAsset.mockResolvedValue(source);
    read.mockResolvedValue(readable(await bigPhoto()));
    const { normalizeAssetOriginal } = await import("./service");

    const result = await normalizeAssetOriginal({ assetId: "asset-1" });

    expect(result.success && result.data.changed).toBe(true);
    expect(store).toHaveBeenCalledWith(expect.objectContaining({ key: "Imagens/u-foto.jpg", contentType: "image/jpeg", allowOverwrite: true }));
    const stored = store.mock.calls[0][0].data as Buffer;
    expect(result.success && result.data.data).toBe(stored);
    expect(updateNormalizedOriginal).toHaveBeenCalledWith("asset-1", {
      filename: "foto.jpg",
      contentType: "image/jpeg",
      size: stored.byteLength,
      checksum: expect.stringMatching(/^[0-9a-f]{64}$/),
      width: 2560,
      height: 1280,
    });
  });

  it("não regrava foto que já está no tamanho, mas devolve os bytes lidos pras variantes", async () => {
    const data = await smallPhoto();
    findOriginalSourceAsset.mockResolvedValue(source);
    read.mockResolvedValue(readable(data));
    const { normalizeAssetOriginal } = await import("./service");

    const result = await normalizeAssetOriginal({ assetId: "asset-1" });

    expect(result).toEqual({ success: true, data: { changed: false, data } });
    expect(store).not.toHaveBeenCalled();
    expect(updateNormalizedOriginal).not.toHaveBeenCalled();
  });

  it("nem baixa do storage o que não é foto (vídeo, PDF)", async () => {
    findOriginalSourceAsset.mockResolvedValue({ ...source, contentType: "video/mp4" });
    const { normalizeAssetOriginal } = await import("./service");

    expect(await normalizeAssetOriginal({ assetId: "asset-1" })).toEqual({ success: true, data: { changed: false, data: null } });
    expect(read).not.toHaveBeenCalled();
  });

  it("falha de storage vira success:false, sem lançar", async () => {
    findOriginalSourceAsset.mockResolvedValue(source);
    read.mockResolvedValue(null);
    const { normalizeAssetOriginal } = await import("./service");

    const result = await normalizeAssetOriginal({ assetId: "asset-1" });
    expect(result.success).toBe(false);
  });
});
