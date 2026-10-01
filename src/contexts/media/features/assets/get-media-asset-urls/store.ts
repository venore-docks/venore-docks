import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import type { MediaVisibility } from "../../../contracts/types";

export type AssetUrlRow = { id: string; url: string; visibility: MediaVisibility; uploadedBy: string | null; accessPermission: string | null };

export async function findAssetUrlsByIds(ids: string[]): Promise<AssetUrlRow[]> {
  const rows = await db
    .select({ id: assets.id, url: assets.url, visibility: assets.visibility, uploadedBy: assets.uploadedBy, accessPermission: assets.accessPermission })
    .from(assets)
    .where(and(inArray(assets.id, ids), isNull(assets.deletedAt)));
  return rows.map((row) => ({ ...row, visibility: row.visibility as MediaVisibility }));
}
