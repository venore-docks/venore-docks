import { beforeEach, describe, expect, it, vi } from "vitest";

const countAssetsByUploader = vi.fn();

vi.mock("./store", () => ({
  countAssetsByUploader: (...args: unknown[]) => countAssetsByUploader(...args),
}));

describe("countAssetsByUploader", () => {
  beforeEach(() => {
    countAssetsByUploader.mockReset();
  });

  it("returns the count from the store", async () => {
    countAssetsByUploader.mockResolvedValue(2);

    const { countAssetsByUploader: service } = await import("./service");
    const result = await service({ uploaderId: "user-1" });

    expect(countAssetsByUploader).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ success: true, data: 2 });
  });
});
