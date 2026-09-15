import { db } from "@/infrastructure/database/client";
import { contentFeedSources } from "../../../database/schema";
import { replaceSourceCategories } from "../../../database/source-categories";
import type { ContentFeedSourceRecord } from "../../../contracts/types";

export async function insertSource(input: {
  name: string;
  remoteUrl: string;
  connectionKey: string;
  categoryKeys: string[];
}): Promise<ContentFeedSourceRecord> {
  const [row] = await db
    .insert(contentFeedSources)
    .values({ name: input.name, remoteUrl: input.remoteUrl, connectionKey: input.connectionKey })
    .returning();
  await replaceSourceCategories(row.id, input.categoryKeys);
  return { ...row, categoryKeys: input.categoryKeys };
}
