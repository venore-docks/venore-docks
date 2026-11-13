import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import { buildVisibilityScope } from "../../../shared/asset-list-filters";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";

export type AssetStatRow = { categoryId: string | null; kind: string; visibility: string; count: number; size: number };

// Um GROUP BY só (categoria × tipo × visibilidade) — o service soma as dimensões que precisa.
export async function findAssetStatRows(scope: MediaActorScope): Promise<AssetStatRow[]> {
  const kind = sql<string>`CASE
    WHEN ${assets.contentType} LIKE 'image/%' THEN 'image'
    WHEN ${assets.contentType} LIKE 'video/%' THEN 'video'
    WHEN ${assets.contentType} LIKE 'audio/%' THEN 'audio'
    ELSE 'document' END`;
  const rows = await db
    .select({
      categoryId: assets.categoryId,
      kind,
      visibility: assets.visibility,
      count: sql<number>`count(*)::int`,
      size: sql<number>`coalesce(sum(${assets.size}), 0)::float8`,
    })
    .from(assets)
    .where(buildVisibilityScope(scope))
    .groupBy(assets.categoryId, kind, assets.visibility);
  return rows;
}
