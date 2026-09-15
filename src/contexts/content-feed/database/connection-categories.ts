import { eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedConnectionCategories } from "./schema";

// Junction connection_categories — compartilhado entre create/list/update-connection-categories,
// mesmo motivo de entry-content-types.ts (docs AGENTS.md §1: store.ts é único ponto de acesso do
// USE CASE, não impede um helper de tabela compartilhado entre vários dentro do mesmo context).

export async function findCategoryIdsForConnection(connectionId: string): Promise<string[]> {
  const rows = await db
    .select({ categoryId: contentFeedConnectionCategories.categoryId })
    .from(contentFeedConnectionCategories)
    .where(eq(contentFeedConnectionCategories.connectionId, connectionId));

  return rows.map((row) => row.categoryId);
}

export async function findCategoryIdsForConnections(connectionIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (connectionIds.length === 0) return map;

  const rows = await db
    .select({ connectionId: contentFeedConnectionCategories.connectionId, categoryId: contentFeedConnectionCategories.categoryId })
    .from(contentFeedConnectionCategories)
    .where(inArray(contentFeedConnectionCategories.connectionId, connectionIds));

  for (const row of rows) {
    const list = map.get(row.connectionId);
    if (list) {
      list.push(row.categoryId);
    } else {
      map.set(row.connectionId, [row.categoryId]);
    }
  }

  return map;
}

// Substitui o conjunto inteiro (delete + insert) — usado tanto por create-connection (conjunto
// inicial) quanto update-connection-categories (troca completa).
export async function replaceConnectionCategories(connectionId: string, categoryIds: string[]): Promise<void> {
  await db.delete(contentFeedConnectionCategories).where(eq(contentFeedConnectionCategories.connectionId, connectionId));
  if (categoryIds.length > 0) {
    await db.insert(contentFeedConnectionCategories).values(categoryIds.map((categoryId) => ({ connectionId, categoryId })));
  }
}
