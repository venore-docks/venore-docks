import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assetVariants } from "../database/schema";

// Acesso a media.asset_variants compartilhado pelos use cases do media que leem ou geram variante
// (get/list anexam, generate grava, purge apaga do storage, read-media-asset serve por largura).

export type AssetVariantRow = {
  assetId: string;
  width: number;
  height: number;
  pathname: string;
  contentType: string;
  size: number;
};

const columns = {
  assetId: assetVariants.assetId,
  width: assetVariants.width,
  height: assetVariants.height,
  pathname: assetVariants.pathname,
  contentType: assetVariants.contentType,
  size: assetVariants.size,
};

export async function findVariantsByAssetIds(assetIds: string[]): Promise<AssetVariantRow[]> {
  if (assetIds.length === 0) return [];
  return db.select(columns).from(assetVariants).where(inArray(assetVariants.assetId, assetIds)).orderBy(asc(assetVariants.width));
}

export async function findVariantByPathname(pathname: string): Promise<AssetVariantRow | null> {
  const [row] = await db.select(columns).from(assetVariants).where(eq(assetVariants.pathname, pathname)).limit(1);
  return row ?? null;
}

// Idempotente por (asset, largura): backfill rodando de novo, ou confirmação do browser e webhook
// do Blob chegando juntos, nunca duplicam.
export async function insertVariants(rows: AssetVariantRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(assetVariants).values(rows).onConflictDoNothing({ target: [assetVariants.assetId, assetVariants.width] });
}
