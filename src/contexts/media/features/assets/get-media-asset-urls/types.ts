import type { OperationResult } from "@/shared/types";

// Lote de ids -> url, pra listagens (blogroll, cards) que antes chamavam getMediaAsset uma vez por
// item (uma sessão + RBAC + SELECT por card).
export type GetMediaAssetUrlsQuery = { ids: string[] };
export type GetMediaAssetUrlsResult = OperationResult<Record<string, string>>;
