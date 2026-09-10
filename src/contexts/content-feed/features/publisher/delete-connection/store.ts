import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedConnections } from "../../../database/schema";

export async function findConnectionById(id: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: contentFeedConnections.id })
    .from(contentFeedConnections)
    .where(eq(contentFeedConnections.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteConnectionById(id: string): Promise<void> {
  // connection_categories cai junto via onDelete: "cascade" (ver database/schema/index.ts).
  await db.delete(contentFeedConnections).where(eq(contentFeedConnections.id, id));
}
