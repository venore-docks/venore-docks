import sharp from "sharp";

// Ajuste do ORIGINAL de uma foto antes (upload server-buffered) ou logo depois (upload direto ao
// Blob, features/assets/normalize-asset-original) de virar asset. Sem banco nem storage aqui — só
// bytes entrando e saindo, pra ser testável isolado (mesmo desenho de image-variants.ts).
//
// Por que existe: o teto de upload de foto é 20 MB (contracts/types.ts) e o original era guardado
// como veio. Ninguém exibe acima de 1920px (maior variante), então guardar 8000px só ocupa Blob.
// Três casos:
//   - HEIC/HEIF (iPhone): sempre vira JPEG — fora do Safari nenhum navegador abre HEIC, e o sharp
//     pré-compilado não decodifica HEVC (patente), então a leitura é pelo heic-decode (libheif em
//     WASM, sem binário nativo — roda na Vercel como está).
//   - JPEG/WebP: reduzido a ORIGINAL_MAX_WIDTH e reencodado no mesmo formato quando é mais largo
//     que isso ou pesa mais que REENCODE_MIN_BYTES. Abaixo dos dois, fica intacto (reencodar só
//     perderia qualidade à toa).
//   - PNG (logo, print de tela, arte): só reduzido quando passa da largura máxima, sem perda.
// GIF (animação) e SVG (vetor) nunca são tocados. O resultado só é usado quando ficou MENOR que o
// original (ou mudou de formato, no HEIC); senão o original segue como veio.
//
// Metadados: o sharp descarta EXIF por padrão — a orientação é aplicada nos pixels (rotate()) e o
// GPS da foto de celular deixa de ir junto pro site público, o que é desejável.

export const ORIGINAL_MAX_WIDTH = 2560;
const REENCODE_MIN_BYTES = 3 * 1024 * 1024;
const ORIGINAL_QUALITY = 85;
// Uma foto de 48 MP decodificada ocupa ~200 MB em RGBA; 100 MP é folga pra qualquer celular atual
// e mantém o pico de memória da função bem abaixo do limite da Vercel.
const HEIF_MAX_PIXELS = 100_000_000;

const HEIF_TYPES = new Set(["image/heic", "image/heif"]);
const NORMALIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", ...HEIF_TYPES]);

export function isHeifContentType(contentType: string): boolean {
  return HEIF_TYPES.has(contentType);
}

// Se vale ler os bytes do original pra tentar ajustar — o upload direto usa isso pra não baixar
// vídeo/PDF do storage à toa.
export function supportsOriginalNormalization(contentType: string): boolean {
  return NORMALIZABLE_TYPES.has(contentType);
}

export type NormalizedOriginal = { data: Buffer; contentType: string; width: number; height: number };

// null = manter o original como veio (tipo fora da lista, já está no tamanho, não ficou menor,
// arquivo ilegível). Nunca lança: ajuste do original é otimização, upload nenhum falha por ela —
// um HEIC que não decodifica fica guardado como HEIC, igual a qualquer outro arquivo.
export async function normalizeImageOriginal(data: Buffer, contentType: string): Promise<NormalizedOriginal | null> {
  try {
    if (HEIF_TYPES.has(contentType)) return await convertHeifToJpeg(data);
    if (contentType === "image/jpeg" || contentType === "image/webp") return await reencodePhoto(data, contentType);
    if (contentType === "image/png") return await shrinkPng(data);
    return null;
  } catch {
    return null;
  }
}

// "IMG_1234.HEIC" -> "IMG_1234.jpg" quando o formato mudou; mesmo nome nos outros casos.
export function normalizedFilename(filename: string, fromContentType: string, toContentType: string): string {
  if (fromContentType === toContentType || toContentType !== "image/jpeg") return filename;
  const withoutExtension = filename.replace(/\.(heic|heif)$/i, "");
  return `${withoutExtension}.jpg`;
}

async function readUprightWidth(data: Buffer): Promise<{ width: number; animated: boolean } | null> {
  const metadata = await sharp(data).metadata();
  if (!metadata.width || !metadata.height) return null;
  // Orientação 5-8 = foto girada 90°: largura e altura trocam depois do rotate().
  const rotated = (metadata.orientation ?? 1) >= 5;
  return { width: rotated ? metadata.height : metadata.width, animated: (metadata.pages ?? 1) > 1 };
}

async function reencodePhoto(data: Buffer, contentType: "image/jpeg" | "image/webp"): Promise<NormalizedOriginal | null> {
  const source = await readUprightWidth(data);
  if (!source || source.animated) return null;
  if (source.width <= ORIGINAL_MAX_WIDTH && data.byteLength <= REENCODE_MIN_BYTES) return null;

  const resized = sharp(data).rotate().resize({ width: ORIGINAL_MAX_WIDTH, withoutEnlargement: true });
  const encoded =
    contentType === "image/jpeg"
      ? resized.jpeg({ quality: ORIGINAL_QUALITY, mozjpeg: true })
      : resized.webp({ quality: ORIGINAL_QUALITY, effort: 4, smartSubsample: true });
  const { data: output, info } = await encoded.toBuffer({ resolveWithObject: true });
  if (output.byteLength >= data.byteLength) return null;
  return { data: output, contentType, width: info.width, height: info.height };
}

async function shrinkPng(data: Buffer): Promise<NormalizedOriginal | null> {
  const source = await readUprightWidth(data);
  if (!source || source.animated || source.width <= ORIGINAL_MAX_WIDTH) return null;

  const { data: output, info } = await sharp(data)
    .rotate()
    .resize({ width: ORIGINAL_MAX_WIDTH })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer({ resolveWithObject: true });
  if (output.byteLength >= data.byteLength) return null;
  return { data: output, contentType: "image/png", width: info.width, height: info.height };
}

async function convertHeifToJpeg(data: Buffer): Promise<NormalizedOriginal | null> {
  // Import sob demanda: o módulo carrega ~1.5 MB de WASM, e só upload de HEIC precisa dele.
  const { default: decodeHeic } = await import("heic-decode");
  const images = await decodeHeic.all({ buffer: data });
  try {
    const primary = images[0];
    if (!primary || primary.width * primary.height > HEIF_MAX_PIXELS) return null;
    // libheif já aplica a rotação gravada no contêiner (irot/imir) ao decodificar.
    const pixels = await primary.decode();
    const raw = Buffer.from(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength);
    const { data: output, info } = await sharp(raw, { raw: { width: pixels.width, height: pixels.height, channels: 4 } })
      .resize({ width: ORIGINAL_MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: ORIGINAL_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data: output, contentType: "image/jpeg", width: info.width, height: info.height };
  } finally {
    images.dispose();
  }
}
