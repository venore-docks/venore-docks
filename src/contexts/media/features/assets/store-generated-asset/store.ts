import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets, categories } from "../../../database/schema";

export async function findAssetsInCategory(ids: string[], categoryKey: string): Promise<{ id: string; pathname: string }[]> {
  if (ids.length === 0) return [];
  return db
    .select({ id: assets.id, pathname: assets.pathname })
    .from(assets)
    .innerJoin(categories, eq(categories.id, assets.categoryId))
    .where(and(inArray(assets.id, ids), eq(categories.key, categoryKey)));
}

export async function hardDeleteAssets(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(assets).where(inArray(assets.id, ids));
}
