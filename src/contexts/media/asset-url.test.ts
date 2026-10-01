import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const servesPublicly = vi.fn();
vi.mock("@/infrastructure/storage", () => ({
  storagePort: {
    servesPublicly: () => servesPublicly(),
    resolveUrl: (key: string) => `https://cdn.test/${key}`,
  },
}));

describe("asset urls", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    servesPublicly.mockReturnValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("serves public assets straight from the storage and everything else through the app", async () => {
    const { resolveAssetUrl } = await import("./asset-url");
    expect(resolveAssetUrl({ id: "a", pathname: "img/a.png", visibility: "public" })).toBe("https://cdn.test/img/a.png");
    expect(resolveAssetUrl({ id: "a", pathname: "img/a.png", visibility: "private" })).toBe("/api/media/asset/a");
    servesPublicly.mockReturnValue(false);
    expect(resolveAssetUrl({ id: "a", pathname: "img/a.png", visibility: "public" })).toBe("/api/media/asset/a");
  });

  it("signs URLs that verify until they expire and cannot be reused for another id", async () => {
    const { createSignedMediaUrl, verifyMediaSignature } = await import("./asset-url");
    const url = new URL(createSignedMediaUrl("asset-1", 60), "https://app.test");
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");

    expect(verifyMediaSignature("asset-1", exp, sig)).toBe(true);
    expect(verifyMediaSignature("asset-2", exp, sig)).toBe(false);
    expect(verifyMediaSignature("asset-1", "1", sig)).toBe(false);
    expect(verifyMediaSignature("asset-1", null, null)).toBe(false);
  });
});
