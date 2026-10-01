import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/attach-asset-variants", () => ({
  attachAssetVariants: async (assets: unknown[]) => assets,
  attachAssetVariantsToOne: async (asset: unknown) => asset,
}));
const generateAssetVariants = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ success: true, data: { generated: 0, skipped: true } }));
vi.mock("../generate-asset-variants/service", () => ({
  generateAssetVariants: (...args: unknown[]) => generateAssetVariants(...args),
}));

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "write", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const findAssetByPathname = vi.fn();
const findActiveAssetByChecksum = vi.fn();
const insertAssetIfAbsent = vi.fn();
vi.mock("./store", () => ({
  findAssetByPathname: (...args: unknown[]) => findAssetByPathname(...args),
  findActiveAssetByChecksum: (...args: unknown[]) => findActiveAssetByChecksum(...args),
  insertAssetIfAbsent: (...args: unknown[]) => insertAssetIfAbsent(...args),
}));

const stat = vi.fn();
const read = vi.fn();
vi.mock("@/infrastructure/storage", () => ({
  storagePort: {
    stat: (...args: unknown[]) => stat(...args),
    read: (...args: unknown[]) => read(...args),
    servesPublicly: () => true,
    resolveUrl: (key: string) => `https://example.blob.vercel-storage.com/${key}`,
  },
}));

const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_HEAD = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

const baseCommand = {
  filename: "photo.png",
  pathname: "uuid-1-photo.png",
  url: "https://example.blob.vercel-storage.com/uuid-1-photo.png",
  contentType: "image/png",
  size: 1024,
  checksum: "checksum-1",
  actorId: "actor-1",
};

const existingAsset = {
  id: "asset-1",
  filename: baseCommand.filename,
  pathname: baseCommand.pathname,
  url: baseCommand.url,
  contentType: baseCommand.contentType,
  size: baseCommand.size,
  width: null,
  height: null,
  alt: null,
  checksum: baseCommand.checksum,
  uploadedBy: "actor-1",
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("registerUploadedMedia", () => {
  beforeEach(() => {
    findAssetByPathname.mockReset();
    findActiveAssetByChecksum.mockReset();
    insertAssetIfAbsent.mockReset();
    stat.mockReset().mockResolvedValue({ size: 1024, contentType: "image/png" });
    read.mockReset().mockImplementation(async () => ({ body: new Blob([PNG_HEAD]).stream(), size: 8, contentType: "image/png", range: null }));
  });

  it("registrar duas vezes o mesmo blob não cria dois registros — retorna a linha existente sem inserir de novo", async () => {
    findAssetByPathname.mockResolvedValue(existingAsset);

    const { registerUploadedMedia } = await import("./service");
    const result = await registerUploadedMedia(baseCommand);

    expect(result).toEqual({ success: true, data: existingAsset });
    expect(insertAssetIfAbsent).not.toHaveBeenCalled();
  });

  it("dedupes by checksum against an active asset when the pathname is new", async () => {
    findAssetByPathname.mockResolvedValue(null);
    findActiveAssetByChecksum.mockResolvedValue(existingAsset);

    const { registerUploadedMedia } = await import("./service");
    const result = await registerUploadedMedia({ ...baseCommand, pathname: "uuid-2-photo-copy.png", checksumVerified: true });

    expect(result).toEqual({ success: true, data: existingAsset });
    expect(insertAssetIfAbsent).not.toHaveBeenCalled();
  });

  it("does not reuse a checksum match that belongs to a soft-deleted asset", async () => {
    findAssetByPathname.mockResolvedValue(null);
    findActiveAssetByChecksum.mockResolvedValue(null); // store already excludes deletedAt rows
    insertAssetIfAbsent.mockResolvedValue({ ...existingAsset, id: "asset-2", pathname: "uuid-3-photo.png" });

    const { registerUploadedMedia } = await import("./service");
    const result = await registerUploadedMedia({ ...baseCommand, pathname: "uuid-3-photo.png" });

    expect(result.success).toBe(true);
    expect(insertAssetIfAbsent).toHaveBeenCalled();
  });

  it("inserts a new row on the first registration", async () => {
    findAssetByPathname.mockResolvedValue(null);
    findActiveAssetByChecksum.mockResolvedValue(null);
    insertAssetIfAbsent.mockResolvedValue(existingAsset);

    const { registerUploadedMedia } = await import("./service");
    const result = await registerUploadedMedia(baseCommand);

    expect(result).toEqual({ success: true, data: existingAsset });
    expect(insertAssetIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: baseCommand.pathname, checksum: baseCommand.checksum, uploadedBy: "actor-1" }),
    );
  });

  it("falls back to a re-fetch by pathname when a concurrent insert wins the unique-index race", async () => {
    findAssetByPathname.mockResolvedValueOnce(null).mockResolvedValueOnce(existingAsset);
    findActiveAssetByChecksum.mockResolvedValue(null);
    insertAssetIfAbsent.mockResolvedValue(null); // onConflictDoNothing returned nothing

    const { registerUploadedMedia } = await import("./service");
    const result = await registerUploadedMedia(baseCommand);

    expect(result).toEqual({ success: true, data: existingAsset });
    expect(findAssetByPathname).toHaveBeenCalledTimes(2);
  });

  it("does not dedupe on a checksum the browser declared (unverified)", async () => {
    findAssetByPathname.mockResolvedValue(null);
    findActiveAssetByChecksum.mockResolvedValue(existingAsset);
    insertAssetIfAbsent.mockResolvedValue({ ...existingAsset, id: "asset-9" });

    const { registerUploadedMedia } = await import("./service");
    await registerUploadedMedia({ ...baseCommand, pathname: "uuid-9.png", checksumVerified: false });

    expect(findActiveAssetByChecksum).not.toHaveBeenCalled();
    expect(insertAssetIfAbsent).toHaveBeenCalled();
  });

  it("refuses to register an object that is not in the storage, and never trusts the client URL", async () => {
    findAssetByPathname.mockResolvedValue(null);
    stat.mockResolvedValue(null);

    const { registerUploadedMedia } = await import("./service");
    const result = await registerUploadedMedia({ ...baseCommand, url: "http://169.254.169.254/latest" });

    expect(result).toEqual({ success: false, error: { code: "media.register.object_not_found", message: expect.any(String) } });
    expect(insertAssetIfAbsent).not.toHaveBeenCalled();
  });

  it("refuses an object whose bytes do not match the declared type", async () => {
    findAssetByPathname.mockResolvedValue(null);
    read.mockImplementation(async () => ({ body: new Blob(["<html><script>"]).stream(), size: 14, contentType: "image/png", range: null }));

    const { registerUploadedMedia } = await import("./service");
    const result = await registerUploadedMedia(baseCommand);

    expect(result).toEqual({ success: false, error: { code: "media.upload.content_mismatch", message: expect.any(String) } });
    expect(read).toHaveBeenCalledWith(baseCommand.pathname, { start: 0, end: 1023 });
    expect(insertAssetIfAbsent).not.toHaveBeenCalled();
  });

  it("takes size and type from the storage, not from the client", async () => {
    findAssetByPathname.mockResolvedValue(null);
    stat.mockResolvedValue({ size: 2048, contentType: "image/webp" });
    read.mockImplementation(async () => ({ body: new Blob([WEBP_HEAD]).stream(), size: 12, contentType: "image/webp", range: null }));
    insertAssetIfAbsent.mockResolvedValue(existingAsset);

    const { registerUploadedMedia } = await import("./service");
    await registerUploadedMedia({ ...baseCommand, size: 1, contentType: "image/png" });

    expect(insertAssetIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ size: 2048, contentType: "image/webp", url: expect.stringContaining("/api/media/asset/") }),
    );
  });
});

