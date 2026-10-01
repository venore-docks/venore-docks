import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries, entryContentTypes } from "../../../database/schema";
import { toEntryRecords } from "../../../database/entry-content-types";
import type { EntryRecord, EntryStatus } from "../../../contracts/types";

export async function findAllEntries(filters: {
  contentTypeId?: string;
  categoryId?: string;
  status?: EntryStatus;
  allowedCategoryIds?: string[];
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<EntryRecord[]> {
  // Sempre exclui entries de outro context/plugin (internalOwner não-null, ex: seções de aula do
  // Academy via page builder — pedido desta sessão) — nunca opcional, /admin/cms/entries não deve
  // listar essas linhas em hipótese nenhuma (ver comentário em EntryRecord.internalOwner).
  const conditions = [isNull(entries.internalOwner)];
  // Fase C: recorte por escopo de categoria. Array vazio → inArray(x, []) → zero linhas (editor
  // sem categoria atribuída não vê nada). categoryId IS NULL fica de fora — entry sem categoria é
  // invisível pro editor escopado (docs/rbac-scoped-roles.md §4.4).
  if (filters.allowedCategoryIds !== undefined) {
    conditions.push(inArray(entries.categoryId, filters.allowedCategoryIds));
  }
  if (filters.contentTypeId) {
    const contentTypeId = filters.contentTypeId;
    conditions.push(
      inArray(
        entries.id,
        db.select({ id: entryContentTypes.entryId }).from(entryContentTypes).where(eq(entryContentTypes.contentTypeId, contentTypeId)),
      ),
    );
  }
  if (filters.categoryId) {
    conditions.push(eq(entries.categoryId, filters.categoryId));
  }
  if (filters.status) {
    conditions.push(eq(entries.status, filters.status));
  }
  const term = filters.search?.trim();
  if (term) {
    // % e _ digitados pelo usuário são literais, não curinga.
    conditions.push(ilike(entries.title, `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`));
  }

  const query = db
    .select()
    .from(entries)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  const rows =
    filters.limit === undefined
      ? await query
      : await query.orderBy(desc(entries.updatedAt), entries.id).limit(filters.limit).offset(filters.offset ?? 0);

  return toEntryRecords(rows);
}
