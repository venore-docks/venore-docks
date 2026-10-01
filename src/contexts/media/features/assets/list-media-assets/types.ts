import type { OperationResult } from "@/shared/types";
import type { MediaAsset } from "../../../contracts/types";

// limit/offset: paginação da tela de mídia (mais recentes primeiro, igual à ordem sem paginação).
export type ListMediaAssetsQuery = { categoryId?: string; limit?: number; offset?: number };
export type ListMediaAssetsResult = OperationResult<MediaAsset[]>;
