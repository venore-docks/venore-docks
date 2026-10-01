import { beforeEach, describe, expect, it, vi } from "vitest";

const findServableAsset = vi.fn();
vi.mock("./store", () => ({ findServableAsset: (...args: unknown[]) => findServableAsset(...args) }));

const read = vi.fn();
vi.mock("@/infrastructure/storage", () => ({ storagePort: { read: (...args: unknown[]) => read(...args) } }));

const verifyMediaSignature = vi.fn();
vi.mock("../../../asset-url", () => ({ verifyMediaSignature: (...args: unknown[]) => verifyMediaSignature(...args) }));

const PRIVATE = { id: "a1", pathname: "docs/a1-cv.pdf", visibility: "private", uploadedBy: "owner" };
const BODY = { body: new Blob(["x"]).stream(), size: 1, contentType: "application/pdf", range: null };

describe("readMediaAsset", () => {
  beforeEach(() => {
    findServableAsset.mockReset();
    read.mockReset().mockResolvedValue(BODY);
    verifyMediaSignature.mockReset().mockReturnValue(false);
  });

  it("serves a public asset to anyone", async () => {
    findServableAsset.mockResolvedValue({ ...PRIVATE, visibility: "public" });
    const { readMediaAsset } = await import("./service");
    expect((await readMediaAsset({ id: "a1" }, null)).success).toBe(true);
  });

  it("hides a private asset from anonymous visitors and other users", async () => {
    findServableAsset.mockResolvedValue(PRIVATE);
    const { readMediaAsset } = await import("./service");
    expect((await readMediaAsset({ id: "a1" }, null)).success).toBe(false);
    expect((await readMediaAsset({ id: "a1" }, { actorId: "someone", isMediaAdmin: false })).success).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it("serves a private asset to its owner, to media admins and with a valid signature", async () => {
    findServableAsset.mockResolvedValue(PRIVATE);
    const { readMediaAsset } = await import("./service");
    expect((await readMediaAsset({ id: "a1" }, { actorId: "owner", isMediaAdmin: false })).success).toBe(true);
    expect((await readMediaAsset({ id: "a1" }, { actorId: "admin", isMediaAdmin: true })).success).toBe(true);
    verifyMediaSignature.mockReturnValue(true);
    expect((await readMediaAsset({ id: "a1", exp: "1", sig: "s" }, null)).success).toBe(true);
  });
});
