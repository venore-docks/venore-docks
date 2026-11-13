import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Sem fixture HEIC no repositório (nenhum encoder HEVC livre pra gerar uma): o decodificador é
// trocado por um fake que devolve pixels RGBA. A decodificação real foi validada à mão com as
// amostras CC0 de nokiatech/heif (8256x5504 -> JPEG 2560px).
const heicDispose = vi.fn();
const heicImage = { width: 3000, height: 2000 };
vi.mock("heic-decode", () => ({
  default: {
    all: vi.fn(async () =>
      Object.assign(
        [
          {
            width: heicImage.width,
            height: heicImage.height,
            decode: async () => ({
              width: heicImage.width,
              height: heicImage.height,
              data: new Uint8ClampedArray(heicImage.width * heicImage.height * 4).fill(180),
            }),
          },
        ],
        { dispose: heicDispose },
      ),
    ),
  },
}));

import { normalizeImageOriginal, normalizedFilename, supportsOriginalNormalization } from "./image-original";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 90 } } });

describe("normalizeImageOriginal", () => {
  beforeEach(() => {
    heicDispose.mockReset();
    heicImage.width = 3000;
    heicImage.height = 2000;
  });

  it("reduz JPEG mais largo que 2560px, mantendo formato e proporção", async () => {
    const original = await solid(4000, 3000).jpeg({ quality: 98 }).toBuffer();
    const result = await normalizeImageOriginal(original, "image/jpeg");

    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/jpeg");
    expect([result!.width, result!.height]).toEqual([2560, 1920]);
    expect(result!.data.byteLength).toBeLessThan(original.byteLength);
    expect((await sharp(result!.data).metadata()).format).toBe("jpeg");
  });

  it("aplica a orientação EXIF antes de medir a largura (foto em pé de celular)", async () => {
    // 4000x3000 deitado com orientação 6 = 3000x4000 em pé.
    const original = await solid(4000, 3000).jpeg({ quality: 98 }).withMetadata({ orientation: 6 }).toBuffer();
    const result = await normalizeImageOriginal(original, "image/jpeg");

    expect([result!.width, result!.height]).toEqual([2560, 3413]);
    expect((await sharp(result!.data).metadata()).orientation).toBeUndefined();
  });

  it("deixa intacta a foto que já está no tamanho e é leve", async () => {
    expect(await normalizeImageOriginal(await solid(1600, 1200).jpeg().toBuffer(), "image/jpeg")).toBeNull();
    expect(await normalizeImageOriginal(await solid(1600, 1200).webp().toBuffer(), "image/webp")).toBeNull();
  });

  it("reduz PNG largo sem trocar de formato, e não mexe em PNG estreito", async () => {
    const wide = await normalizeImageOriginal(await solid(3200, 400).png({ compressionLevel: 0 }).toBuffer(), "image/png");
    expect(wide?.contentType).toBe("image/png");
    expect(wide?.width).toBe(2560);

    expect(await normalizeImageOriginal(await solid(800, 400).png({ compressionLevel: 0 }).toBuffer(), "image/png")).toBeNull();
  });

  it("converte HEIC em JPEG de no máximo 2560px e libera o decodificador", async () => {
    const result = await normalizeImageOriginal(Buffer.from("heic"), "image/heic");

    expect(result?.contentType).toBe("image/jpeg");
    expect([result?.width, result?.height]).toEqual([2560, 1707]);
    expect((await sharp(result!.data).metadata()).format).toBe("jpeg");
    expect(heicDispose).toHaveBeenCalledOnce();
  });

  it("recusa decodificar HEIC acima de 100 MP (fica como veio)", async () => {
    heicImage.width = 12000;
    heicImage.height = 9000;
    expect(await normalizeImageOriginal(Buffer.from("heic"), "image/heif")).toBeNull();
    expect(heicDispose).toHaveBeenCalledOnce();
  });

  it("nunca lança: GIF, SVG, vídeo e arquivo ilegível ficam como vieram", async () => {
    expect(await normalizeImageOriginal(await solid(3000, 100).gif().toBuffer(), "image/gif")).toBeNull();
    expect(await normalizeImageOriginal(Buffer.from("<svg/>"), "image/svg+xml")).toBeNull();
    expect(await normalizeImageOriginal(Buffer.from("not an image"), "image/jpeg")).toBeNull();
    expect(await normalizeImageOriginal(Buffer.from("x"), "video/mp4")).toBeNull();
  });
});

describe("supportsOriginalNormalization", () => {
  it("só fotos — vídeo/PDF nem são baixados do storage", () => {
    expect(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].every(supportsOriginalNormalization)).toBe(true);
    expect(["image/gif", "image/svg+xml", "video/mp4", "application/pdf"].some(supportsOriginalNormalization)).toBe(false);
  });
});

describe("normalizedFilename", () => {
  it("troca a extensão só quando HEIC virou JPEG", () => {
    expect(normalizedFilename("IMG_1234.HEIC", "image/heic", "image/jpeg")).toBe("IMG_1234.jpg");
    expect(normalizedFilename("foto.heif", "image/heif", "image/jpeg")).toBe("foto.jpg");
    expect(normalizedFilename("sem-extensao", "image/heic", "image/jpeg")).toBe("sem-extensao.jpg");
    expect(normalizedFilename("foto.jpg", "image/jpeg", "image/jpeg")).toBe("foto.jpg");
  });
});
