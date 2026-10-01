import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability", () => ({
  beginOperation: vi.fn(() => ({ operationId: "op-1", useCase: "test", actor: { id: "actor-1", type: "user" }, kind: "read", startedAt: new Date() })),
  endOperation: vi.fn(),
}));

const directUploadKind = vi.fn(() => "vercel-blob");
const createUploadTicket = vi.fn();
vi.mock("@/infrastructure/storage", () => ({
  storagePort: {
    directUploadKind: () => directUploadKind(),
    createUploadTicket: (...args: unknown[]) => createUploadTicket(...args),
  },
}));

describe("validateMediaUploadCandidate", () => {
  it("rejects a contentType that is not in the allowlist", async () => {
    const { validateMediaUploadCandidate } = await import("./service");
    const result = validateMediaUploadCandidate({ contentType: "image/bmp", size: 1024 });
    expect(result).toEqual({ success: false, error: { code: "media.upload.unsupported_type", message: expect.any(String) } });
  });

  it("rejects size <= 0", async () => {
    const { validateMediaUploadCandidate } = await import("./service");
    const result = validateMediaUploadCandidate({ contentType: "image/png", size: 0 });
    expect(result).toEqual({ success: false, error: { code: "media.upload.invalid_size", message: expect.any(String) } });
  });

  it("accepts a size exactly at the category limit (boundary)", async () => {
    const { validateMediaUploadCandidate } = await import("./service");
    const maxSizeBytes = 8 * 1024 * 1024;
    const result = validateMediaUploadCandidate({ contentType: "image/png", size: maxSizeBytes });
    expect(result).toEqual({ success: true, data: { maxSizeBytes } });
  });

  it("rejects a size one byte over the category limit (boundary)", async () => {
    const { validateMediaUploadCandidate } = await import("./service");
    const maxSizeBytes = 8 * 1024 * 1024;
    const result = validateMediaUploadCandidate({ contentType: "image/png", size: maxSizeBytes + 1 });
    expect(result).toEqual({ success: false, error: { code: "media.upload.file_too_large", message: expect.any(String) } });
  });
});

describe("requestMediaUploadTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails validation before generating a pathname", async () => {
    const { requestMediaUploadTicket } = await import("./service");
    const result = await requestMediaUploadTicket({ filename: "photo.bmp", contentType: "image/bmp", size: 10, actorId: "actor-1" });
    expect(result).toEqual({
      success: false,
      error: { code: "media.upload.unsupported_type", message: expect.any(String) },
    });
  });

  it("rejects image/svg+xml — SVG only goes through the server-buffered upload, never the direct-to-Blob ticket", async () => {
    const { requestMediaUploadTicket } = await import("./service");
    const result = await requestMediaUploadTicket({ filename: "icon.svg", contentType: "image/svg+xml", size: 10, actorId: "actor-1" });
    expect(result).toEqual({
      success: false,
      error: { code: "media.upload.requires_buffered_upload", message: expect.any(String) },
    });
  });

  it("sanitizes the filename, prefixes it with a random uuid, and puts it in the type folder", async () => {
    const { requestMediaUploadTicket } = await import("./service");
    const result = await requestMediaUploadTicket({ filename: "my photo (final)!.png", contentType: "image/png", size: 1024, actorId: "actor-1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pathname).toMatch(/^Imagens\/[0-9a-f-]{36}-my_photo__final__\.png$/);
    expect(result.data.contentType).toBe("image/png");
  });

  it("diz ao browser pra usar o cliente do Vercel Blob no driver vercel-blob", async () => {
    directUploadKind.mockReturnValue("vercel-blob");
    const { requestMediaUploadTicket } = await import("./service");
    const result = await requestMediaUploadTicket({ filename: "v.mp4", contentType: "video/mp4", size: 1024, actorId: "actor-1" });
    expect(result.success && result.data.directUpload).toEqual({ method: "vercel-blob" });
    expect(createUploadTicket).not.toHaveBeenCalled();
  });

  it("emite um presigned POST no driver s3, com o limite de tamanho do tipo", async () => {
    directUploadKind.mockReturnValue("presigned-post");
    createUploadTicket.mockResolvedValue({ key: "k", uploadUrl: "https://b.s3.amazonaws.com/", token: "", fields: { key: "k", Policy: "p" }, expiresAt: new Date() });
    const { requestMediaUploadTicket } = await import("./service");
    const result = await requestMediaUploadTicket({ filename: "v.mp4", contentType: "video/mp4", size: 1024, actorId: "actor-1" });

    expect(result.success && result.data.directUpload).toEqual({ method: "presigned-post", url: "https://b.s3.amazonaws.com/", fields: { key: "k", Policy: "p" } });
    expect(createUploadTicket).toHaveBeenCalledWith(expect.objectContaining({ contentType: "video/mp4", maxSizeBytes: 200 * 1024 * 1024 }));
  });

  it("recusa upload direto no driver que não suporta (filesystem)", async () => {
    directUploadKind.mockReturnValue("unsupported");
    const { requestMediaUploadTicket } = await import("./service");
    const result = await requestMediaUploadTicket({ filename: "v.mp4", contentType: "video/mp4", size: 1024, actorId: "actor-1" });
    expect(result).toMatchObject({ success: false, error: { code: "media.upload.direct_unsupported" } });
  });
});
