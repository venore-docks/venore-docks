import { beforeEach, describe, expect, it, vi } from "vitest";

const countAssetsByUploader = vi.fn();

vi.mock("./service", () => ({
  countAssetsByUploader: (...args: unknown[]) => countAssetsByUploader(...args),
}));

describe("countAssetsByUploaderHandler", () => {
  beforeEach(() => {
    countAssetsByUploader.mockReset();
  });

  it("delegates to the service", async () => {
    countAssetsByUploader.mockResolvedValue({ success: true, data: 0 });

    const { countAssetsByUploaderHandler } = await import("./handler");
    const result = await countAssetsByUploaderHandler({ uploaderId: "user-1" });

    expect(countAssetsByUploader).toHaveBeenCalledWith({ uploaderId: "user-1" });
    expect(result).toEqual({ success: true, data: 0 });
  });
});
