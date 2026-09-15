import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedConnections } from "../../../database/schema";
import { replaceConnectionCategories } from "../../../database/connection-categories";
import type { ContentFeedConnectionRecord } from "../../../contracts/types";

export async function findConnectionById(id: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: contentFeedConnections.id })
    .from(contentFeedConnections)
    .where(eq(contentFeedConnections.id, id))
    .limit(1);
  return row ?? null;
}

export async function applyConnectionCategories(id: string, categoryIds: string[]): Promise<ContentFeedConnectionRecord> {
  await replaceConnectionCategories(id, categoryIds);
  const [row] = await db.select().from(contentFeedConnections).where(eq(contentFeedConnections.id, id)).limit(1);
  return { ...row, categoryIds };
}
