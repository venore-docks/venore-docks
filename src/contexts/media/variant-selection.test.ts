import { describe, expect, it } from "vitest";
import { buildMediaSrcSet, pickMediaVariantUrl } from "./variant-selection";

const variant = (width: number) => ({ width, height: width, size: width, contentType: "image/webp", url: `v${width}` });
const asset = { url: "original", variants: [variant(960), variant(160), variant(480)] };

describe("pickMediaVariantUrl", () => {
  it("pega a menor variante que cobre a largura na tela em 2x", () => {
    expect(pickMediaVariantUrl(asset, 48)).toBe("v160");
    expect(pickMediaVariantUrl(asset, 200)).toBe("v480");
    expect(pickMediaVariantUrl(asset, 241)).toBe("v960");
    expect(pickMediaVariantUrl(asset, 100, 1)).toBe("v160");
  });

  it("sem variante que cubra, a maior", () => {
    expect(pickMediaVariantUrl(asset, 2000)).toBe("v960");
  });

  it("sem largura ou sem variantes, o original", () => {
    expect(pickMediaVariantUrl(asset)).toBe("original");
    expect(pickMediaVariantUrl({ url: "original" }, 48)).toBe("original");
    expect(pickMediaVariantUrl({ url: "original", variants: [] }, 48)).toBe("original");
  });
});

describe("buildMediaSrcSet", () => {
  it("lista as variantes em ordem crescente com descritor de largura", () => {
    expect(buildMediaSrcSet(asset)).toBe("v160 160w, v480 480w, v960 960w");
    expect(buildMediaSrcSet({ url: "original" })).toBeUndefined();
  });
});
