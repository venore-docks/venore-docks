import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { toEntryRecords } from "../../../database/entry-content-types";
import { entries } from "../../../database/schema";
import type { EntryRecord } from "../../../contracts/types";

// Mesmos caracteres de drizzle/0050_entries_search.sql — se mudar lá, muda aqui.
const SEARCH_FOLD_FROM = "áàâãäéèêëíìîïóòôõöúùûüç";
const SEARCH_FOLD_TO = "aaaaaeeeeiiiiooooouuuuc";

// A coluna search_vector é gerada no banco (migration 0050, fora do schema Drizzle). A consulta
// casa o texto como digitado OU sem acento — mesmo par que a coluna guarda.
export async function searchPublishedEntries(filters: {
  query: string;
  includeAuthenticated: boolean;
  limit: number;
  offset: number;
}): Promise<EntryRecord[]> {
  const tsQuery = sql`(websearch_to_tsquery('portuguese', lower(${filters.query})) || websearch_to_tsquery('portuguese', translate(lower(${filters.query}), ${SEARCH_FOLD_FROM}, ${SEARCH_FOLD_TO})))`;
  const vector = sql`"cms"."entries"."search_vector"`;

  const conditions = [
    eq(entries.status, "published"),
    isNull(entries.internalOwner),
    sql`${vector} @@ ${tsQuery}`,
    ...(filters.includeAuthenticated ? [] : [eq(entries.visibility, "public")]),
  ];

  const rows = await db
    .select()
    .from(entries)
    .where(and(...conditions))
    .orderBy(sql`ts_rank(${vector}, ${tsQuery}) desc`, desc(entries.publishedAt), entries.id)
    .limit(filters.limit)
    .offset(filters.offset);

  return toEntryRecords(rows);
}
