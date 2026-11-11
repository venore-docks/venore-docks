import { getCache, setCache } from "../../../../../infrastructure/cache/memory-cache";
import { findCategoryTypeCounts } from "./store";
import type { CategoryTypeCount, CountCategoryEntriesByTypeQuery, CountCategoryEntriesByTypeResult } from "./types";

// Prefixo "cms:entries:published" de propósito: toda escrita de entry já invalida esse prefixo.
const CACHE_TTL_SECONDS = 60;

export async function countCategoryEntriesByType(query: CountCategoryEntriesByTypeQuery): Promise<CountCategoryEntriesByTypeResult> {
  const cacheKey = `cms:entries:published:type-counts:${query.categoryId}:${query.visibility ?? "*"}`;
  const cached = getCache<CategoryTypeCount[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const counts = await findCategoryTypeCounts(query);
  setCache(cacheKey, counts, CACHE_TTL_SECONDS);
  return { success: true, data: counts };
}
