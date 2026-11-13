import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import { buildAssetFilters, buildAssetOrder, type AssetListFilters, type MediaSort } from "../../../shared/asset-list-filters";
import type { MediaAsset } from "../../../contracts/types";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";

export async function findAllAssets(
  scope: MediaActorScope,
  filters: AssetListFilters = {},
  sort: MediaSort = "newest",
  page?: { limit: number; offset: number },
): Promise<MediaAsset[]> {
  const query = db.select().from(assets).where(buildAssetFilters(scope, filters)).orderBy(...buildAssetOrder(sort));
  const rows = page ? await query.limit(page.limit).offset(page.offset) : await query;
  return rows as MediaAsset[];
}
