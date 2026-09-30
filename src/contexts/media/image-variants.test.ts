import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { encodeImageVariants, planVariantWidths, supportsImageVariants, variantPathname } from "./image-variants";

async function jpeg(width: number, height: number, orientation?: number): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 90 } } }).jpeg({ quality: 95 });
  return orientation ? image.withMetadata({ orientation }).toBuffer() : image.toBuffer();
}

describe("planVariantWidths", () => {
  it("usa a escala abaixo do original e fecha no próprio original, sem ampliar", () => {
    expect(planVariantWidths(4000)).toEqual([160, 480, 960, 1920]);
    expect(planVariantWidths(1500)).toEqual([160, 480, 960, 1500]);
    expect(planVariantWidths(480)).toEqual([160, 480]);
    expect(planVariantWidths(100)).toEqual([100]);
    expect(planVariantWidths(0)).toEqual([]);
  });
});

describe("variantPathname", () => {
  it("troca a extensão pela largura + .webp, na mesma pasta", () => {
    expect(variantPathname("Imagens/abc-foto.jpg", 480)).toBe("Imagens/abc-foto.w480.webp");
    expect(variantPathname("Imagens/abc-sem-extensao", 160)).toBe("Imagens/abc-sem-extensao.w160.webp");
    expect(variantPathname("pasta.com.ponto/abc", 160)).toBe("pasta.com.ponto/abc.w160.webp");
  });
});

describe("encodeImageVariants", () => {
  it("gera WebP em cada largura, mantendo a proporção", async () => {
    const result = await encodeImageVariants(await jpeg(2400, 1200), "image/jpeg");
    expect(result).not.toBeNull();
    expect(result!.width).toBe(2400);
    expect(result!.variants.map((variant) => [variant.width, variant.height])).toEqual([
      [160, 80],
      [480, 240],
      [960, 480],
      [1920, 960],
    ]);
    const meta = await sharp(result!.variants[0].data).metadata();
    expect(meta.format).toBe("webp");
  });

  it("aplica a orientação EXIF (foto de celular em pé)", async () => {
    // 6 = girada 90°: o arquivo tem 1200x600, a foto de verdade é 600x1200.
    const result = await encodeImageVariants(await jpeg(1200, 600, 6), "image/jpeg");
    expect(result!.width).toBe(600);
    expect(result!.height).toBe(1200);
    expect(result!.variants.at(-1)).toMatchObject({ width: 600, height: 1200 });
  });

  it("não devolve variante na largura original quando ela ficaria maior que o arquivo", async () => {
    const tinyPng = await sharp({ create: { width: 120, height: 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    const result = await encodeImageVariants(tinyPng, "image/png");
    expect(result).not.toBeNull();
    for (const variant of result!.variants) {
      expect(variant.data.byteLength).toBeLessThan(tinyPng.byteLength);
    }
  });

  it("ignora tipo sem suporte e arquivo corrompido", async () => {
    expect(supportsImageVariants("image/gif")).toBe(false);
    expect(supportsImageVariants("image/svg+xml")).toBe(false);
    expect(await encodeImageVariants(Buffer.from("GIF89a"), "image/gif")).toBeNull();
    expect(await encodeImageVariants(Buffer.from("não é imagem"), "image/jpeg")).toBeNull();
  });
});
