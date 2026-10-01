import { searchPublishedEntries as findMatches } from "./store";
import type { SearchPublishedEntriesQuery, SearchPublishedEntriesResult } from "./types";

export async function searchPublishedEntries(query: SearchPublishedEntriesQuery): Promise<SearchPublishedEntriesResult> {
  const entries = await findMatches({ ...query, limit: query.limit + 1 });
  return { success: true, data: { entries: entries.slice(0, query.limit), hasMore: entries.length > query.limit } };
}
