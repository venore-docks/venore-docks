import { desc } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedConnections } from "../../../database/schema";
import { findCategoryIdsForConnections } from "../../../database/connection-categories";
import type { ContentFeedConnectionRecord } from "../../../contracts/types";

export async function findAllConnections(): Promise<ContentFeedConnectionRecord[]> {
  const rows = await db.select().from(contentFeedConnections).orderBy(desc(contentFeedConnections.createdAt));
  const categoryIdsByConnection = await findCategoryIdsForConnections(rows.map((row) => row.id));

  return rows.map((row) => ({ ...row, categoryIds: categoryIdsByConnection.get(row.id) ?? [] }));
}
