import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";

export async function countEntriesByAuthor(authorId: string): Promise<number> {
  const rows = await db.select({ id: entries.id }).from(entries).where(eq(entries.authorId, authorId));
  return rows.length;
}
