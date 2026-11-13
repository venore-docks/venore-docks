import type { OperationResult } from "@/shared/types";
import type { MediaAsset, MediaVisibility } from "../../../contracts/types";
import type { MediaKind, MediaSort } from "../../../shared/asset-list-filters";

// limit/offset: paginação da tela de mídia. categoryId "none" = arquivos sem categoria.
// search = trecho do nome do arquivo; kind = tipo de biblioteca (imagem/vídeo/áudio/documento).
export type ListMediaAssetsQuery = {
  categoryId?: string;
  search?: string;
  kind?: MediaKind;
  visibility?: MediaVisibility;
  sort?: MediaSort;
  limit?: number;
  offset?: number;
};
export type ListMediaAssetsResult = OperationResult<MediaAsset[]>;
