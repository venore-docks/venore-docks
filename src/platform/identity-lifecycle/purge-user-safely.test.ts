import { beforeEach, describe, expect, it, vi } from "vitest";

const purgeUser = vi.fn();
const countCmsEntriesByAuthor = vi.fn();
const countAssetsByUploader = vi.fn();

vi.mock("@/contexts/auth", () => ({
  purgeUser: (...args: unknown[]) => purgeUser(...args),
}));
vi.mock("@/contexts/cms", () => ({
  countCmsEntriesByAuthor: (...args: unknown[]) => countCmsEntriesByAuthor(...args),
}));
vi.mock("@/contexts/media", () => ({
  countAssetsByUploader: (...args: unknown[]) => countAssetsByUploader(...args),
}));

describe("purgeUserSafely", () => {
  beforeEach(() => {
    purgeUser.mockReset();
    countCmsEntriesByAuthor.mockReset();
    countAssetsByUploader.mockReset();
  });

  it("blocks the purge when the user still has CMS entries", async () => {
    countCmsEntriesByAuthor.mockResolvedValue({ success: true, data: 2 });
    countAssetsByUploader.mockResolvedValue({ success: true, data: 0 });

    const { purgeUserSafely } = await import("./purge-user-safely");
    const result = await purgeUserSafely({ targetUserId: "user-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.purge.still_referenced", message: expect.stringContaining("2 entradas de CMS") },
    });
    expect(purgeUser).not.toHaveBeenCalled();
  });

  it("blocks the purge when the user still has media assets", async () => {
    countCmsEntriesByAuthor.mockResolvedValue({ success: true, data: 0 });
    countAssetsByUploader.mockResolvedValue({ success: true, data: 1 });

    const { purgeUserSafely } = await import("./purge-user-safely");
    const result = await purgeUserSafely({ targetUserId: "user-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "auth.purge.still_referenced", message: expect.stringContaining("1 arquivo de mídia") },
    });
    expect(purgeUser).not.toHaveBeenCalled();
  });

  it("purges the user when there is nothing referenced", async () => {
    countCmsEntriesByAuthor.mockResolvedValue({ success: true, data: 0 });
    countAssetsByUploader.mockResolvedValue({ success: true, data: 0 });
    purgeUser.mockResolvedValue({ success: true, data: { id: "user-1" } });

    const { purgeUserSafely } = await import("./purge-user-safely");
    const result = await purgeUserSafely({ targetUserId: "user-1" });

    expect(purgeUser).toHaveBeenCalledWith({ targetUserId: "user-1" });
    expect(result).toEqual({ success: true, data: { id: "user-1" } });
  });
});
