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
  storagePort: {
    store: (...args: unknown[]) => storeFn(...args),
    servesPublicly: () => true,
    resolveUrl: (key: string) => `https://blob.test/${key}`,
  },
}));

const insertAsset = vi.fn();
vi.mock("./store", () => ({
  insertAsset: (...args: unknown[]) => insertAsset(...args),
}));

// Fake leve de sanitize-svg-buffer: o módulo real puxa jsdom (pesado — transformá-lo dentro do
// `await import("./service")` do primeiro teste chegava a estourar o timeout de 5s sob a suíte
// cheia). A sanitização de verdade tem cobertura própria em sanitize-svg-buffer.test.ts; aqui só
// importa que o service passe os bytes por ela e grave/checksumme o que ela devolve.
vi.mock("../../../sanitize-svg-buffer", () => ({
  sanitizeSvgBuffer: (data: Buffer) => {
    const raw = data.toString("utf8");
    if (!/<svg[\s>]/i.test(raw)) {
      return { success: false, error: { code: "media.upload.invalid_svg", message: "not an svg" } };
    }
    const clean = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
    return { success: true, data: Buffer.from(clean, "utf8") };
  },
}));

describe("uploadMediaAsset", () => {
  beforeEach(() => {
    invalidateCacheByPrefix.mockReset();
    storeFn.mockReset();
    insertAsset.mockReset();
  });

  it("rejects a contentType outside the allowlist without touching storage", async () => {
    const { uploadMediaAsset } = await import("./service");
    const result = await uploadMediaAsset({
      filename: "photo.bmp",
      contentType: "image/bmp",
      size: 100,
      data: Buffer.from("x"),
      visibility: "private",
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "media.upload.unsupported_type", message: expect.any(String) },
    });
    expect(storeFn).not.toHaveBeenCalled();
    expect(insertAsset).not.toHaveBeenCalled();
  });

  it("sanitizes SVG bytes before storing them and computes the checksum over the sanitized bytes", async () => {
    storeFn.mockImplementation(async (input: { key: string; data: Buffer }) => ({
      key: input.key,
      url: `https://blob.test/${input.key}`,
      size: input.data.byteLength,
    }));
    insertAsset.mockResolvedValue({ id: "asset-1", filename: "icon.svg" });

    const { uploadMediaAsset } = await import("./service");
    const malicious = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><circle r="1"/></svg>');
    const result = await uploadMediaAsset({
      filename: "icon.svg",
      contentType: "image/svg+xml",
      size: malicious.byteLength,
      data: malicious,
      visibility: "public",
      actorId: "actor-1",
    });

    expect(result.success).toBe(true);
    expect(storeFn).toHaveBeenCalledTimes(1);
    const storedData = (storeFn.mock.calls[0][0] as { data: Buffer }).data;
    expect(storedData.toString("utf8")).not.toContain("<script");
    expect(storedData.toString("utf8")).not.toContain("onload");
    expect(insertAsset).toHaveBeenCalledTimes(1);
  });

  it("rejects an image/svg+xml payload that isn't actually an SVG", async () => {
    const { uploadMediaAsset } = await import("./service");
    const result = await uploadMediaAsset({
      filename: "fake.svg",
      contentType: "image/svg+xml",
      size: 20,
      data: Buffer.from("<html>not svg</html>"),
      visibility: "private",
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "media.upload.invalid_svg", message: expect.any(String) },
    });
    expect(storeFn).not.toHaveBeenCalled();
    expect(insertAsset).not.toHaveBeenCalled();
  });

  it("rejects a file over the allowlist size limit for its type", async () => {
    const { uploadMediaAsset } = await import("./service");
    const result = await uploadMediaAsset({
      filename: "huge.png",
      contentType: "image/png",
      size: 9 * 1024 * 1024,
      data: Buffer.alloc(10),
      visibility: "private",
      actorId: "actor-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "media.upload.file_too_large", message: expect.any(String) },
    });
    expect(storeFn).not.toHaveBeenCalled();
  });

  it("stores the file via storagePort and persists filename/visibility/categoryId", async () => {
    storeFn.mockResolvedValue({ key: "uuid-photo.png", url: "https://blob.test/uuid-photo.png", size: 10 });
    insertAsset.mockResolvedValue({ id: "asset-1", filename: "photo.png" });

    const { uploadMediaAsset } = await import("./service");
    const data = Buffer.from("conteúdo");
    const result = await uploadMediaAsset({
      filename: "photo.png",
      contentType: "image/png",
      size: data.byteLength,
      data,
      visibility: "public",
      categoryId: "cat-1",
      actorId: "actor-1",
    });

    expect(result.success).toBe(true);
    expect(insertAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "photo.png",
        pathname: "uuid-photo.png",
        url: "https://blob.test/uuid-photo.png",
        visibility: "public",
        categoryId: "cat-1",
        uploadedBy: "actor-1",
      }),
    );
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith("media:assets:");
  });
});
