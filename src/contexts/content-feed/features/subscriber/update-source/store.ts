import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedSources } from "../../../database/schema";
import { findCategoryKeysForSource, replaceSourceCategories } from "../../../database/source-categories";
import type { ContentFeedSourceRecord } from "../../../contracts/types";

export async function findSourceById(id: string): Promise<{ id: string } | null> {
  const [row] = await db.select({ id: contentFeedSources.id }).from(contentFeedSources).where(eq(contentFeedSources.id, id)).limit(1);
  return row ?? null;
}

export async function applySourceUpdate(
  id: string,
  patch: { name?: string; remoteUrl?: string; connectionKey?: string; categoryKeys?: string[] },
): Promise<ContentFeedSourceRecord> {
  const { categoryKeys, ...columns } = patch;
  if (Object.keys(columns).length > 0) {
    await db.update(contentFeedSources).set(columns).where(eq(contentFeedSources.id, id));
  }
  if (categoryKeys) {
    await replaceSourceCategories(id, categoryKeys);
  }

  const [row] = await db.select().from(contentFeedSources).where(eq(contentFeedSources.id, id)).limit(1);
  const resolvedCategoryKeys = categoryKeys ?? (await findCategoryKeysForSource(id));
  return { ...row, categoryKeys: resolvedCategoryKeys };
}
