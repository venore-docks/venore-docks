import { searchPublishedEntries } from "./service";
import type { SearchPublishedEntriesQuery, SearchPublishedEntriesResult } from "./types";

const MAX_QUERY_LENGTH = 120;
const MAX_LIMIT = 50;

// Leitura pública (só conteúdo publicado). Limite de requisições fica em quem chama (página /busca).
export async function searchPublishedEntriesHandler(query: SearchPublishedEntriesQuery): Promise<SearchPublishedEntriesResult> {
  const text = query.query.trim().slice(0, MAX_QUERY_LENGTH);
  if (text.length < 2) {
    return { success: true, data: { entries: [], hasMore: false } };
  }
  return searchPublishedEntries({
    query: text,
    includeAuthenticated: query.includeAuthenticated,
    limit: Math.min(Math.max(query.limit, 1), MAX_LIMIT),
    offset: Math.max(query.offset, 0),
  });
}
