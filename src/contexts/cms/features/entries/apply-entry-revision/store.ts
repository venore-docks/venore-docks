import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries, entryRevisions } from "../../../database/schema";
import { replaceEntryContentTypes, toEntryRecord } from "../../../database/entry-content-types";
import type { EntryRecord } from "../../../contracts/types";
import type { RevisionRow } from "../../../shared/entry-revisions";

export async function findEntryById(id: string): Promise<EntryRecord | null> {
  const [row] = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  return row ? await toEntryRecord(row) : null;
}

export async function slugTakenByAnotherEntry(id: string, categoryId: string | null, slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(categoryId ? eq(entries.categoryId, categoryId) : isNull(entries.categoryId), eq(entries.slug, slug), ne(entries.id, id)))
    .limit(1);
  return Boolean(row);
}

// Aplica o estado da revisão na entry e, se for proposta, marca como aplicada — tudo no mesmo
// commit. A proposta só é marcada se ainda estiver pendente (duas pessoas aplicando ao mesmo
// tempo: a segunda falha e a transação inteira volta).
export async function applyRevisionState(revision: RevisionRow, actorId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (revision.kind === "proposal") {
      const resolved = await tx
        .update(entryRevisions)
        .set({ status: "applied", resolvedBy: actorId, resolvedAt: sql`now()` })
        .where(and(eq(entryRevisions.id, revision.id), eq(entryRevisions.status, "pending")))
        .returning({ id: entryRevisions.id });
      if (resolved.length === 0) return false;
    }

    await tx
      .update(entries)
      .set({
        title: revision.title,
        slug: revision.slug,
        categoryId: revision.categoryId,
        visibility: revision.visibility,
        mediaId: revision.mediaId,
        data: revision.data ?? {},
        updatedAt: sql`now()`,
      })
      .where(eq(entries.id, revision.entryId));

    if (revision.contentTypeIds) {
      await replaceEntryContentTypes(tx, revision.entryId, revision.contentTypeIds);
    }
    return true;
  });
}
