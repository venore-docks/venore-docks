import type { OperationResult } from "@/shared/types";

// Lote de ids -> url, pra listagens (blogroll, cards) que antes chamavam getMediaAsset uma vez por
// item (uma sessão + RBAC + SELECT por card).
export type GetMediaAssetUrlsQuery = {
  ids: string[];
  // Largura em que a imagem aparece na tela (CSS px): devolve a URL da menor variante que cobre
  // (variant-selection.ts pickMediaVariantUrl). Ausente = URL do original.
  displayWidth?: number;
};
export type GetMediaAssetUrlsResult = OperationResult<Record<string, string>>;

// getMediaAssetImages: a mesma URL escolhida acima + dimensões do original (null quando o asset
// ainda não as tem — upload direto antigo sem backfill de variantes).
export type MediaAssetImage = { url: string; width: number | null; height: number | null };
export type GetMediaAssetImagesResult = OperationResult<Record<string, MediaAssetImage>>;
