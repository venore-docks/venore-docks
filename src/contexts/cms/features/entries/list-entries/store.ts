import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries, entryContentTypes } from "../../../database/schema";
import { toEntryRecords } from "../../../database/entry-content-types";
import type { EntryRecord, EntryVisibility } from "../../../contracts/types";

export async function findPublishedEntries(filters: {
  contentTypeId?: string;
  categoryId?: string;
  categoryIds?: string[];
  visibility?: EntryVisibility;
  updatedSince?: Date;
  includeInternallyOwned?: boolean;
}): Promise<EntryRecord[]> {
  const conditions = [eq(entries.status, "published")];
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
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    conditions.push(inArray(entries.categoryId, filters.categoryIds));
  }
  if (filters.visibility) {
    conditions.push(eq(entries.visibility, filters.visibility));
  }
  if (filters.updatedSince) {
    conditions.push(gt(entries.updatedAt, filters.updatedSince));
  }
  // Nunca inclui entry de outro context/plugin (ex: aula do academy) numa listagem que não pediu
  // explicitamente por isso — mesmo critério que list-entries-for-admin já aplica incondicionalmente
  // (ver comentário no schema, internal_owner).
  if (!filters.includeInternallyOwned) {
    conditions.push(isNull(entries.internalOwner));
  }

  const rows = await db
    .select()
    .from(entries)
    .where(and(...conditions));

  return toEntryRecords(rows);
}
