import sharp, { type Metadata } from "sharp";

// Geração das cópias redimensionadas de uma imagem (features/assets/generate-asset-variants). Sem
// banco nem storage aqui — só bytes entrando e saindo, pra ser testável isolado.
//
// Por que existe: o original subia e era servido cru em todo <img> (foto de celular de 2-8 MB num
// avatar de 48px). Cada visita baixava o arquivo inteiro do Blob, e a cota de transferência do
// plano estourava. O original continua guardado intacto; o que muda é o que a PÁGINA baixa.
//
// Larguras: 160 (avatar/brasão/lista), 480 (card), 960 (destaque/coluna), 1920 (tela cheia/capa).
// Quem exibe pede a largura na tela e recebe a menor variante que cobre o dobro disso (tela
// retina) — variant-selection.ts. WebP porque todo navegador atual abre e fica ~30% menor que
// JPEG na mesma qualidade visual; qualidade 82 em foto é indistinguível do original no tamanho
// exibido. PNG de origem (logo, brasão, arte com borda dura) vai com qualidade 90 pra não borrar
// contorno, e o alpha sempre sem perda.
export const MEDIA_VARIANT_WIDTHS = [160, 480, 960, 1920] as const;
export const MEDIA_VARIANT_CONTENT_TYPE = "image/webp";

const PHOTO_QUALITY = 82;
const GRAPHIC_QUALITY = 90;

// GIF fica de fora (animado — reencodar perderia a animação); SVG é vetor, não tem o que reduzir.
const VARIANT_SOURCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function supportsImageVariants(contentType: string): boolean {
  return VARIANT_SOURCE_TYPES.has(contentType);
}

// "Imagens/<uuid>-foto.jpg" -> "Imagens/<uuid>-foto.w480.webp". Mesma pasta do original, e o UUID
// do nome já garante que não colide com nada.
export function variantPathname(originalPathname: string, width: number): string {
  const slash = originalPathname.lastIndexOf("/");
  const dot = originalPathname.lastIndexOf(".");
  const base = dot > slash ? originalPathname.slice(0, dot) : originalPathname;
  return `${base}.w${width}.webp`;
}

// Larguras que valem a pena pra uma imagem de `sourceWidth` px: as da escala que são menores que
// ela, mais a própria largura (limitada a 1920) — uma foto de 1500px ganha 160/480/960/1500, uma
// de 4000px ganha 160/480/960/1920. Nunca amplia.
export function planVariantWidths(sourceWidth: number): number[] {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return [];
  const max = MEDIA_VARIANT_WIDTHS[MEDIA_VARIANT_WIDTHS.length - 1];
  const widths = MEDIA_VARIANT_WIDTHS.filter((width) => width < sourceWidth) as number[];
  widths.push(Math.min(Math.round(sourceWidth), max));
  return [...new Set(widths)].sort((a, b) => a - b);
}

export type EncodedVariant = { width: number; height: number; data: Buffer };

export type EncodedImage = {
  // Dimensões do ORIGINAL já com a orientação EXIF aplicada (foto de celular deitada vira em pé).
  width: number;
  height: number;
  variants: EncodedVariant[];
};

// null = não é imagem que dê pra reduzir (tipo fora da lista, animada, arquivo corrompido). Nunca
// lança: variante é otimização, upload nenhum pode falhar por causa dela.
export async function encodeImageVariants(data: Buffer, contentType: string): Promise<EncodedImage | null> {
  if (!supportsImageVariants(contentType)) return null;

  let metadata: Metadata;
  try {
    metadata = await sharp(data).metadata();
  } catch {
    return null;
  }
  if (!metadata.width || !metadata.height) return null;
  // WebP animado: mesmo motivo do GIF.
  if ((metadata.pages ?? 1) > 1) return null;

  // Orientação 5-8 = foto girada 90°: largura e altura trocam depois do rotate().
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;

  const quality = contentType === "image/png" ? GRAPHIC_QUALITY : PHOTO_QUALITY;
  const variants: EncodedVariant[] = [];
  for (const targetWidth of planVariantWidths(width)) {
    try {
      const { data: output, info } = await sharp(data)
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp({ quality, alphaQuality: 100, effort: 4, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      // Na largura do próprio original, só vale guardar se ficou menor que ele (um PNG já pequeno
      // pode sair maior em WebP) — senão quem exibe usa o original mesmo.
      if (targetWidth >= width && output.byteLength >= data.byteLength) continue;
      variants.push({ width: info.width, height: info.height, data: output });
    } catch {
      return null;
    }
  }

  return { width, height, variants };
}
