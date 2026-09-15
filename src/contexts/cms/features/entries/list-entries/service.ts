import { getCache, setCache } from "../../../../../infrastructure/cache/memory-cache";
import { findPublishedEntries } from "./store";
import { toEntryView } from "./view";
import type { ListEntriesQuery, ListEntriesResult, EntryView } from "./types";

const PUBLISHED_ENTRIES_CACHE_TTL_SECONDS = 60;

function cacheKeyFor(query: ListEntriesQuery): string {
  const categoryIds = query.categoryIds && query.categoryIds.length > 0 ? [...query.categoryIds].sort().join(",") : "*";
  return `cms:entries:published:${query.contentTypeId ?? "*"}:${query.categoryId ?? "*"}:${categoryIds}:${query.visibility ?? "*"}:${query.includeInternallyOwned ? "withInternal" : "*"}`;
}

export async function listEntries(query: ListEntriesQuery): Promise<ListEntriesResult> {
  // updatedSince é um cursor de polling (feed federado) — cada chamada tende a ter um valor
  // diferente, então cachear por ele só inflaria o cache sem nunca dar hit; pula cache nesse caso.
  if (query.updatedSince) {
    const records = await findPublishedEntries(query);
    return { success: true, data: records.map(toEntryView) };
  }

  const cacheKey = cacheKeyFor(query);
  const cached = getCache<EntryView[]>(cacheKey);
  if (cached) {
    return { success: true, data: cached };
  }

  const records = await findPublishedEntries(query);
  const views = records.map(toEntryView);
  setCache(cacheKey, views, PUBLISHED_ENTRIES_CACHE_TTL_SECONDS);

  return { success: true, data: views };
}
