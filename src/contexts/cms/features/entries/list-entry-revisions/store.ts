import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";

export async function findEntryCategory(id: string): Promise<{ categoryId: string | null } | null> {
  const [row] = await db.select({ categoryId: entries.categoryId }).from(entries).where(eq(entries.id, id)).limit(1);
  return row ?? null;
}
