import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import type { MediaVisibility } from "../../../contracts/types";

export type ServableAsset = { id: string; pathname: string; visibility: MediaVisibility; uploadedBy: string | null };

export async function findServableAsset(by: { id?: string; pathname?: string }): Promise<ServableAsset | null> {
  const key = by.id ? eq(assets.id, by.id) : by.pathname ? eq(assets.pathname, by.pathname) : null;
  if (!key) return null;
  const [row] = await db
    .select({ id: assets.id, pathname: assets.pathname, visibility: assets.visibility, uploadedBy: assets.uploadedBy })
    .from(assets)
    .where(and(key, isNull(assets.deletedAt)))
    .limit(1);
  return row ? { ...row, visibility: row.visibility as MediaVisibility } : null;
}
