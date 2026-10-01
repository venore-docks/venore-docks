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

const findVariantsByAssetIds = vi.fn();
const insertVariants = vi.fn();
vi.mock("../../../shared/asset-variants-store", () => ({
  findVariantsByAssetIds: (...args: unknown[]) => findVariantsByAssetIds(...args),
  insertVariants: (...args: unknown[]) => insertVariants(...args),
}));

const findVariantSourceAsset = vi.fn();
const markVariantsProcessed = vi.fn();
vi.mock("./store", () => ({
  findVariantSourceAsset: (...args: unknown[]) => findVariantSourceAsset(...args),
  markVariantsProcessed: (...args: unknown[]) => markVariantsProcessed(...args),
}));

const photo = () => sharp({ create: { width: 1000, height: 500, channels: 3, background: "#336699" } }).jpeg().toBuffer();
const source = { id: "asset-1", pathname: "Imagens/u-foto.jpg", contentType: "image/jpeg", width: null, height: null };

describe("generateAssetVariants", () => {
  beforeEach(() => {
    for (const fn of [store, read, findVariantsByAssetIds, insertVariants, findVariantSourceAsset, markVariantsProcessed]) fn.mockReset();
    store.mockImplementation(async (input: { key: string; data: Buffer }) => ({ key: input.key, url: `u/${input.key}`, size: input.data.byteLength }));
    findVariantsByAssetIds.mockResolvedValue([]);
  });

  it("grava uma variante por largura e marca o asset com as dimensões reais", async () => {
    findVariantSourceAsset.mockResolvedValue(source);
    const { generateAssetVariants } = await import("./service");

    const result = await generateAssetVariants({ assetId: "asset-1", data: await photo() });

    expect(result).toEqual({ success: true, data: { generated: 4, skipped: false } });
    expect(store.mock.calls.map(([input]) => input.key)).toEqual([
      "Imagens/u-foto.w160.webp",
      "Imagens/u-foto.w480.webp",
      "Imagens/u-foto.w960.webp",
      "Imagens/u-foto.w1000.webp",
    ]);
    expect(store.mock.calls[0][0]).toMatchObject({ contentType: "image/webp", allowOverwrite: true });
    expect(insertVariants.mock.calls[0][0]).toHaveLength(4);
    expect(markVariantsProcessed).toHaveBeenCalledWith(source, { width: 1000, height: 500 });
    expect(read).not.toHaveBeenCalled();
  });

  it("lê o original do storage quando não recebe os bytes, e pula larguras que já existem", async () => {
    findVariantSourceAsset.mockResolvedValue(source);
    findVariantsByAssetIds.mockResolvedValue([{ width: 160 }, { width: 480 }]);
    const bytes = await photo();
    read.mockResolvedValue({ body: new Response(bytes).body, size: bytes.byteLength, contentType: "image/jpeg", range: null });
    const { generateAssetVariants } = await import("./service");

    const result = await generateAssetVariants({ assetId: "asset-1" });

    expect(read).toHaveBeenCalledWith("Imagens/u-foto.jpg");
    expect(result).toEqual({ success: true, data: { generated: 2, skipped: false } });
  });

  it("marca como processado sem gerar nada quando não é imagem reduzível", async () => {
    findVariantSourceAsset.mockResolvedValue({ ...source, contentType: "application/pdf" });
    const { generateAssetVariants } = await import("./service");

    const result = await generateAssetVariants({ assetId: "asset-1", data: Buffer.from("%PDF") });

    expect(result).toEqual({ success: true, data: { generated: 0, skipped: true } });
    expect(store).not.toHaveBeenCalled();
    expect(markVariantsProcessed).toHaveBeenCalledWith(expect.objectContaining({ id: "asset-1" }), null);
  });

  it("falha do storage vira erro de resultado (não lança) e deixa o asset pendente", async () => {
    findVariantSourceAsset.mockResolvedValue(source);
    store.mockRejectedValue(new Error("quota"));
    const { generateAssetVariants } = await import("./service");

    const result = await generateAssetVariants({ assetId: "asset-1", data: await photo() });

    expect(result).toEqual({ success: false, error: { code: "media.variants.failed", message: "quota" } });
    expect(markVariantsProcessed).not.toHaveBeenCalled();
  });
});
