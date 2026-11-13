import { getCache, setCache } from "@/infrastructure/cache/memory-cache";
import { findAllAssets } from "./store";
import { attachAssetVariants } from "../../../shared/attach-asset-variants";
import type { MediaAsset } from "../../../contracts/types";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";
import type { ListMediaAssetsQuery, ListMediaAssetsResult } from "./types";

const MEDIA_LIST_CACHE_TTL_SECONDS = 300;

// Chave inclui o escopo do ator (visibilidade varia por quem pergunta) e todos os filtros — mesmo
// raciocínio de cms:content-types cachear entryCount (Fase 3/C8): uma chave por combinação,
// nunca uma só compartilhada. Prefixo "media:assets:" é o que os services de escrita invalidam.
function cacheKeyFor(scope: MediaActorScope, query: ListMediaAssetsQuery): string {
  // superadmin vê "restricted" e media.manage não — caches separados.
  const scopePart = scope.isSuperadmin ? "superadmin" : scope.isMediaAdmin ? "admin" : `actor:${scope.actorId}`;
  const categoryPart = query.categoryId ?? "all";
  const pagePart = query.limit === undefined ? "all" : `${query.limit}@${query.offset ?? 0}`;
  // Busca codificada: pode conter ":" ou qualquer outro caractere.
  const filterPart = [
    query.kind ?? "",
    query.visibility ?? "",
    query.sort ?? "",
    encodeURIComponent(query.search?.trim().toLowerCase() ?? ""),
  ].join("|");
  return `media:assets:${scopePart}:category:${categoryPart}:filters:${filterPart}:page:${pagePart}`;
}

export async function listMediaAssets(scope: MediaActorScope, query: ListMediaAssetsQuery = {}): Promise<ListMediaAssetsResult> {
  const cacheKey = cacheKeyFor(scope, query);
  const cached = getCache<MediaAsset[]>(cacheKey);
  if (cached) {
    return { success: true, data: cached };
  }

  const page = query.limit === undefined ? undefined : { limit: query.limit, offset: query.offset ?? 0 };
  const media = await attachAssetVariants(
    await findAllAssets(
      scope,
      {
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search ? { search: query.search } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.visibility ? { visibility: query.visibility } : {}),
      },
      query.sort,
      page,
    ),
  );
  setCache(cacheKey, media, MEDIA_LIST_CACHE_TTL_SECONDS);

  return { success: true, data: media };
}
