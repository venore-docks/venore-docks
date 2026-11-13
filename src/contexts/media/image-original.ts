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
//   - JPEG/WebP: reduzido a ORIGINAL_MAX_WIDTH e reencodado (exceto se já couber nos dois limites) no mesmo formato, com qualidade
//     adaptativa que desce até o arquivo caber em ~TARGET_BYTES (média de ~200 KB por foto, pedido
//     do admin de mídia). Se o resultado não ficar menor, o original segue como veio.
//   - PNG (logo, print de tela, arte): reduzido à largura máxima e, se ainda passar de TARGET_BYTES,
//     quantizado em paleta (continua PNG, mantém transparência). PNG sem transparência que mesmo
//     assim não cabe (foto salva como PNG) vira JPEG.
// GIF (animação) e SVG (vetor) nunca são tocados. O resultado só é usado quando ficou MENOR que o
// original (ou mudou de formato, no HEIC); senão o original segue como veio.
//
// Metadados: o sharp descarta EXIF por padrão — a orientação é aplicada nos pixels (rotate()) e o
// GPS da foto de celular deixa de ir junto pro site público, o que é desejável.

// 1920px = a maior variante exibida pelo site; guardar mais que isso só ocupa Blob.
export const ORIGINAL_MAX_WIDTH = 1920;
// Alvo de peso por foto. Fotos comuns ficam em 150–300 KB em 1920px; cena muito detalhada pode
// passar um pouco, pois a qualidade não desce de ORIGINAL_QUALITY_STEPS[último].
const TARGET_BYTES = 200 * 1024;
const ORIGINAL_QUALITY_STEPS = [78, 70, 62, 55, 48];
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

// "IMG_1234.HEIC" / "arte.png" -> ".jpg" quando o formato mudou; mesmo nome nos outros casos.
export function normalizedFilename(filename: string, fromContentType: string, toContentType: string): string {
  if (fromContentType === toContentType || toContentType !== "image/jpeg") return filename;
  const withoutExtension = filename.replace(/\.(heic|heif|png)$/i, "");
  return `${withoutExtension}.jpg`;
}

async function readUprightWidth(data: Buffer): Promise<{ width: number; animated: boolean; hasAlpha: boolean } | null> {
  const metadata = await sharp(data).metadata();
  if (!metadata.width || !metadata.height) return null;
  // Orientação 5-8 = foto girada 90°: largura e altura trocam depois do rotate().
  const rotated = (metadata.orientation ?? 1) >= 5;
  return { width: rotated ? metadata.height : metadata.width, animated: (metadata.pages ?? 1) > 1, hasAlpha: Boolean(metadata.hasAlpha) };
}

async function reencodePhoto(data: Buffer, contentType: "image/jpeg" | "image/webp"): Promise<NormalizedOriginal | null> {
  const source = await readUprightWidth(data);
  if (!source || source.animated) return null;
  // Já no tamanho e dentro do alvo: reencodar só perderia qualidade à toa.
  if (source.width <= ORIGINAL_MAX_WIDTH && data.byteLength <= TARGET_BYTES) return null;

  // Redimensiona uma vez, reencoda de cima pra baixo na qualidade até caber no alvo.
  const { data: base, info: baseInfo } = await sharp(data)
    .rotate()
    .resize({ width: ORIGINAL_MAX_WIDTH, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = await encodeUnderTarget(base, baseInfo, contentType);
  if (output.byteLength >= data.byteLength) return null;
  return { data: output, contentType, width: baseInfo.width, height: baseInfo.height };
}

async function encodeUnderTarget(
  raw: Buffer,
  info: { width: number; height: number; channels: number },
  contentType: "image/jpeg" | "image/webp",
): Promise<Buffer> {
  let output = raw;
  for (const quality of ORIGINAL_QUALITY_STEPS) {
    const pipeline = sharp(raw, { raw: { width: info.width, height: info.height, channels: info.channels as 3 | 4 } });
    output = await (contentType === "image/jpeg"
      ? pipeline.jpeg({ quality, mozjpeg: true })
      : pipeline.webp({ quality, effort: 4, smartSubsample: true })
    ).toBuffer();
    if (output.byteLength <= TARGET_BYTES) break;
  }
  return output;
}

async function shrinkPng(data: Buffer): Promise<NormalizedOriginal | null> {
  const source = await readUprightWidth(data);
  if (!source || source.animated) return null;
  // Já no tamanho e dentro do alvo: nada a ganhar.
  if (source.width <= ORIGINAL_MAX_WIDTH && data.byteLength <= TARGET_BYTES) return null;

  const resize = () => sharp(data).rotate().resize({ width: ORIGINAL_MAX_WIDTH, withoutEnlargement: true });

  // Paleta (estilo pngquant): continua PNG e preserva transparência; ótimo pra arte/print/infográfico.
  const palette = await resize()
    .png({ palette: true, quality: 80, effort: 7, compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  let best: NormalizedOriginal = { data: palette.data, contentType: "image/png", width: palette.info.width, height: palette.info.height };

  // Sem transparência e ainda pesado = foto salva como PNG: JPEG resolve.
  if (!source.hasAlpha && palette.data.byteLength > TARGET_BYTES) {
    const flat = await resize().flatten({ background: "#ffffff" }).raw().toBuffer({ resolveWithObject: true });
    const jpeg = await encodeUnderTarget(flat.data, flat.info, "image/jpeg");
    if (jpeg.byteLength < best.data.byteLength) {
      best = { data: jpeg, contentType: "image/jpeg", width: flat.info.width, height: flat.info.height };
    }
  }

  if (best.data.byteLength >= data.byteLength) return null;
  return best;
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
      .jpeg({ quality: ORIGINAL_QUALITY_STEPS[0], mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data: output, contentType: "image/jpeg", width: info.width, height: info.height };
  } finally {
    images.dispose();
  }
}
