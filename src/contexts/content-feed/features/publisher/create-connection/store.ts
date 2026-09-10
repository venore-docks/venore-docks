import { db } from "@/infrastructure/database/client";
import { contentFeedConnections } from "../../../database/schema";
import { replaceConnectionCategories } from "../../../database/connection-categories";
import type { ContentFeedConnectionRecord } from "../../../contracts/types";

export async function insertConnection(input: { name: string; categoryIds: string[] }): Promise<ContentFeedConnectionRecord> {
  const [row] = await db.insert(contentFeedConnections).values({ name: input.name }).returning();
  await replaceConnectionCategories(row.id, input.categoryIds);
  return { ...row, categoryIds: input.categoryIds };
}
