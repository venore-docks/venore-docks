import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";

export type VariantSourceAsset = {
  id: string;
  pathname: string;
  contentType: string;
  width: number | null;
  height: number | null;
};

export async function findVariantSourceAsset(id: string): Promise<VariantSourceAsset | null> {
  const [row] = await db
    .select({ id: assets.id, pathname: assets.pathname, contentType: assets.contentType, width: assets.width, height: assets.height })
    .from(assets)
    .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
    .limit(1);
  return row ?? null;
}

// Marca o asset como processado (o backfill para de pegá-lo) e, se ainda não tinha, grava as
// dimensões reais do original — o upload direto ao Blob nunca preenchia width/height.
export async function markVariantsProcessed(
  asset: Pick<VariantSourceAsset, "id" | "width" | "height">,
  dimensions: { width: number; height: number } | null,
): Promise<void> {
  const fillDimensions = dimensions !== null && (asset.width === null || asset.height === null);
  await db
    .update(assets)
    .set({ variantsProcessedAt: new Date(), ...(fillDimensions ? { width: dimensions.width, height: dimensions.height } : {}) })
    .where(eq(assets.id, asset.id));
}
