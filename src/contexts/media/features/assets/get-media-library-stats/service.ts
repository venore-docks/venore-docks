import { getCache, setCache } from "@/infrastructure/cache/memory-cache";
import { findAssetStatRows } from "./store";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";
import type { GetMediaLibraryStatsResult, MediaLibraryStats } from "./types";

const CACHE_TTL_SECONDS = 300;

// Mesmo prefixo da listagem: upload/exclusão/recategorização já invalidam "media:assets:".
function cacheKeyFor(scope: MediaActorScope): string {
  const scopePart = scope.isSuperadmin ? "superadmin" : scope.isMediaAdmin ? "admin" : `actor:${scope.actorId}`;
  return `media:assets:${scopePart}:stats`;
}

export async function getMediaLibraryStats(scope: MediaActorScope): Promise<GetMediaLibraryStatsResult> {
  const cacheKey = cacheKeyFor(scope);
  const cached = getCache<MediaLibraryStats>(cacheKey);
  if (cached) return { success: true, data: cached };

  const rows = await findAssetStatRows(scope);
  const stats: MediaLibraryStats = {
    total: 0,
    uncategorized: 0,
    byCategory: {},
    byKind: { image: 0, video: 0, audio: 0, document: 0 },
    byVisibility: { public: 0, restricted: 0, private: 0 },
    totalSize: 0,
  };

  for (const row of rows) {
    stats.total += row.count;
    stats.totalSize += row.size;
    if (row.categoryId) stats.byCategory[row.categoryId] = (stats.byCategory[row.categoryId] ?? 0) + row.count;
    else stats.uncategorized += row.count;
    if (row.kind in stats.byKind) stats.byKind[row.kind as keyof typeof stats.byKind] += row.count;
    if (row.visibility in stats.byVisibility) stats.byVisibility[row.visibility as keyof typeof stats.byVisibility] += row.count;
  }

  setCache(cacheKey, stats, CACHE_TTL_SECONDS);
  return { success: true, data: stats };
}
