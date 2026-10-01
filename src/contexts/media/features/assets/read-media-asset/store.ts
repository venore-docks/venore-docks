import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assetVariants, assets } from "../../../database/schema";
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
  if (row) return { ...row, visibility: row.visibility as MediaVisibility };
  if (!by.pathname) return null;

  // Driver filesystem serve por pathname, e uma variante tem pathname próprio: devolve o asset
  // dono (autorização é a dele) com o pathname da variante.
  const [variant] = await db
    .select({ id: assets.id, pathname: assetVariants.pathname, visibility: assets.visibility, uploadedBy: assets.uploadedBy })
    .from(assetVariants)
    .innerJoin(assets, eq(assetVariants.assetId, assets.id))
    .where(and(eq(assetVariants.pathname, by.pathname), isNull(assets.deletedAt)))
    .limit(1);
  return variant ? { ...variant, visibility: variant.visibility as MediaVisibility } : null;
}

export async function findVariantPathname(assetId: string, width: number): Promise<string | null> {
  const [row] = await db
    .select({ pathname: assetVariants.pathname })
    .from(assetVariants)
    .where(and(eq(assetVariants.assetId, assetId), eq(assetVariants.width, width)))
    .limit(1);
  return row?.pathname ?? null;
}
