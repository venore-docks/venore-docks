import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";

// Opção "Gerar áudio" da edição (data.speech === true).
const speechChosen = sql`(${entries.data} ->> 'speech') = 'true'`;
const readable = and(eq(entries.status, "published"), eq(entries.visibility, "public"), isNull(entries.internalOwner), speechChosen);

export async function findReadableEntriesUpdatedAfter(updatedAfter: Date | null, limit: number) {
  return db
    .select({ id: entries.id, title: entries.title, data: entries.data, updatedAt: entries.updatedAt })
    .from(entries)
    // Cursor vem de um Date do JS (milissegundos) e o Postgres guarda microssegundos: sem truncar,
    // a última entry sincronizada seria "mais nova" que o cursor para sempre.
    .where(
      updatedAfter
        ? and(readable, sql`date_trunc('milliseconds', ${entries.updatedAt}) > ${updatedAfter.toISOString()}::timestamptz`)
        : readable,
    )
    .orderBy(asc(entries.updatedAt), asc(entries.id))
    .limit(limit);
}

// Entry que ainda pode manter o áudio: existe, é pública e editorial, não foi arquivada e segue
// com a opção ligada. Rascunho/agendada mantém (despublicar e republicar não gera de novo).
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
        speechChosen,
      ),
    );
  return rows.map((row) => row.id);
}
