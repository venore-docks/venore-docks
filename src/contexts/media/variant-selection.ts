import type { MediaAsset, MediaAssetVariant } from "./contracts/types";

// Escolha de qual cópia de uma imagem exibir — puro, sem banco, reexportado pelo SDK de plugin
// (@venore/plugin-sdk/media) e usado por tema/admin. Variantes vêm de getMediaAsset/listMediaAssets
// (image-variants.ts explica as larguras).

type AssetWithVariants = Pick<MediaAsset, "url"> & { variants?: MediaAssetVariant[] | null };

// Densidade assumida da tela: celular hoje é quase sempre 2x ou 3x; 2x é o meio-termo que ainda
// fica nítido em 3x no tamanho de avatar/card e não baixa o dobro sem necessidade.
const DEFAULT_PIXEL_DENSITY = 2;

// URL da menor variante que cobre `displayWidth` CSS px na densidade pedida; sem nenhuma que
// cubra, a maior disponível; sem variante nenhuma (não é imagem, upload antigo ainda sem
// backfill), o original. displayWidth ausente = o original (download, geração de capa etc.).
export function pickMediaVariantUrl(
  asset: AssetWithVariants,
  displayWidth?: number,
  pixelDensity = DEFAULT_PIXEL_DENSITY,
): string {
  const variants = asset.variants ?? [];
  if (!displayWidth || variants.length === 0) return asset.url;
  const needed = displayWidth * pixelDensity;
  const sorted = [...variants].sort((a, b) => a.width - b.width);
  return (sorted.find((variant) => variant.width >= needed) ?? sorted[sorted.length - 1]).url;
}

// `srcset` com descritor de largura ("url 160w, url 480w, ...") pra <img srcSet sizes> — o
// navegador escolhe sozinho pela largura real e densidade da tela. undefined sem variantes (o
// <img> fica só com src, igual a antes).
export function buildMediaSrcSet(asset: AssetWithVariants): string | undefined {
  const variants = asset.variants ?? [];
  if (variants.length === 0) return undefined;
  return [...variants]
    .sort((a, b) => a.width - b.width)
    .map((variant) => `${variant.url} ${variant.width}w`)
    .join(", ");
}
