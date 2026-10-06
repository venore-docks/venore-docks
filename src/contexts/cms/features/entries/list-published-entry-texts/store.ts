import { and, asc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";

const readable = and(eq(entries.status, "published"), eq(entries.visibility, "public"), isNull(entries.internalOwner));

export async function findReadableEntriesUpdatedAfter(updatedAfter: Date | null, limit: number) {
  return db
    .select({ id: entries.id, title: entries.title, data: entries.data, updatedAt: entries.updatedAt })
    .from(entries)
    .where(updatedAfter ? and(readable, gt(entries.updatedAt, updatedAfter)) : readable)
    .orderBy(asc(entries.updatedAt), asc(entries.id))
    .limit(limit);
}

// Entry que ainda pode manter o áudio: existe, é pública e editorial e não foi arquivada.
// Rascunho/agendada mantém (despublicar e republicar não paga a síntese de novo).
export async function findEntryIdsKeepingSpeech(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        inArray(entries.id, ids),
        ne(entries.status, "archived"),
        eq(entries.visibility, "public"),
        isNull(entries.internalOwner),
      ),
    );
  return rows.map((row) => row.id);
}
