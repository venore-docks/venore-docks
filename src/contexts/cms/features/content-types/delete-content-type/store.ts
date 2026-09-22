import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentTypes, entryContentTypes } from "../../../database/schema";
import { findContentTypeIdsForEntries } from "../../../database/entry-content-types";
import type { ContentTypeRecord } from "../../../contracts/types";

export async function findContentTypeById(id: string): Promise<ContentTypeRecord | null> {
  const [row] = await db.select().from(contentTypes).where(eq(contentTypes.id, id)).limit(1);
  return row ?? null;
}

// Entries que ficariam com ZERO tags se `contentTypeId` fosse removido sem reatribuição — a
// regra "toda entry tem pelo menos 1 tag" (create-entry/update-entry) é decidida aqui antes de
// qualquer escrita, não depois. findContentTypeIdsForEntries já existe (database/entry-content-
// types.ts, compartilhado entre vários use cases de entries) — reaproveitado em vez de reescrever
// a mesma junção.
export async function findExclusivelyTaggedEntryIds(contentTypeId: string): Promise<string[]> {
  const rows = await db
    .select({ entryId: entryContentTypes.entryId })
    .from(entryContentTypes)
    .where(eq(entryContentTypes.contentTypeId, contentTypeId));

  const entryIds = rows.map((row) => row.entryId);
  if (entryIds.length === 0) return [];

  const contentTypeIdsByEntry = await findContentTypeIdsForEntries(entryIds);
  return entryIds.filter((entryId) => (contentTypeIdsByEntry.get(entryId) ?? []).length === 1);
}

// Remove a tag de toda entry que a tinha — com reassignToId, cada uma ganha a tag de destino
// ANTES de perder a antiga (onConflictDoNothing cobre a entry que já tinha as duas), garantindo
// que nenhuma passa por um estado intermediário sem tag nenhuma. Tudo em uma transação: a FK
// entry_content_types.content_type_id é "restrict", então content_types só pode ser deletada
// depois que as linhas do junction que apontam pra ela já sumiram.
export async function removeContentType(id: string, reassignToId: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    if (reassignToId) {
      const tagged = await tx
        .select({ entryId: entryContentTypes.entryId })
        .from(entryContentTypes)
        .where(eq(entryContentTypes.contentTypeId, id));

      if (tagged.length > 0) {
        await tx
          .insert(entryContentTypes)
          .values(tagged.map((row) => ({ entryId: row.entryId, contentTypeId: reassignToId })))
          .onConflictDoNothing({ target: [entryContentTypes.entryId, entryContentTypes.contentTypeId] });
      }
    }

    await tx.delete(entryContentTypes).where(eq(entryContentTypes.contentTypeId, id));
    await tx.delete(contentTypes).where(eq(contentTypes.id, id));
  });
}
