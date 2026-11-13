import type { OperationResult } from "@/shared/types";
import type { MediaVisibility } from "../../../contracts/types";
import type { MediaKind } from "../../../shared/asset-list-filters";

// Contagens da biblioteca inteira (respeitando só o escopo do ator) — alimentam a barra lateral
// de categorias e os chips de tipo/visibilidade, que mostram quantos arquivos há em cada um.
export type MediaLibraryStats = {
  total: number;
  uncategorized: number;
  byCategory: Record<string, number>;
  byKind: Record<MediaKind, number>;
  byVisibility: Record<MediaVisibility, number>;
  totalSize: number;
};
export type GetMediaLibraryStatsResult = OperationResult<MediaLibraryStats>;
