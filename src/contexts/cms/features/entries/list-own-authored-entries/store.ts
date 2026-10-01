import { desc, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries } from "../../../database/schema";
import type { OwnAuthoredEntry } from "./types";

export async function findEntriesAuthoredBy(userId: string): Promise<OwnAuthoredEntry[]> {
  return db
    .select({ id: entries.id, title: entries.title, slug: entries.slug, status: entries.status, createdAt: entries.createdAt, updatedAt: entries.updatedAt })
    .from(entries)
    .where(eq(entries.authorId, userId))
    .orderBy(desc(entries.createdAt));
}
