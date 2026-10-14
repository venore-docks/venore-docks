import { eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";
import type { EntryRecord } from "../../../contracts/types";

export async function findEntryById(id: string): Promise<EntryRecord | null> {
  const [row] = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  return (row as EntryRecord) ?? null;
}

// Grava o `data` inteiro já mesclado pelo service (data.layout trocado, resto preservado) — mesmo
// formato de saveEntryComposition.
export async function saveEntryData(id: string, data: Record<string, unknown>): Promise<EntryRecord> {
  const [row] = await db.update(entries).set({ data, updatedAt: sql`now()` }).where(eq(entries.id, id)).returning();
  return row as EntryRecord;
}
