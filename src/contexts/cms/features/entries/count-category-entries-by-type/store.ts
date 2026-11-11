import { and, asc, count, eq, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentTypes, entries, entryContentTypes } from "../../../database/schema";
import type { CategoryTypeCount, CountCategoryEntriesByTypeQuery } from "./types";

// Quantas entries publicadas de uma categoria há por content type (N:N via entry_content_types).
// Mesmas condições da listagem (findPublishedEntries): publicada, sem dono interno, visibilidade
// opcional. Só devolve tipos com pelo menos 1 entry.
export async function findCategoryTypeCounts(query: CountCategoryEntriesByTypeQuery): Promise<CategoryTypeCount[]> {
  const conditions = [eq(entries.categoryId, query.categoryId), eq(entries.status, "published"), isNull(entries.internalOwner)];
  if (query.visibility) conditions.push(eq(entries.visibility, query.visibility));

  const rows = await db
    .select({ contentTypeId: contentTypes.id, key: contentTypes.key, name: contentTypes.name, count: count(entries.id) })
    .from(entryContentTypes)
    .innerJoin(entries, eq(entries.id, entryContentTypes.entryId))
    .innerJoin(contentTypes, eq(contentTypes.id, entryContentTypes.contentTypeId))
    .where(and(...conditions))
    .groupBy(contentTypes.id, contentTypes.key, contentTypes.name)
    .orderBy(asc(contentTypes.name));

  return rows.map((row) => ({ contentTypeId: row.contentTypeId, key: row.key, name: row.name, count: Number(row.count) }));
}
