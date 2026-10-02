import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { MEDIA_ASSET_ROUTE } from "../../../asset-url";
import { assets, categories } from "../../../database/schema";

// Marca como "restricted" (com a accessPermission dada) todo asset da categoria reservada que
// ainda não está assim. Idempotente: só toca linha divergente.
export async function restrictAssetsInCategory(categoryKey: string, accessPermission: string): Promise<number> {
  const categoryIds = db.select({ id: categories.id }).from(categories).where(eq(categories.key, categoryKey));
  const rows = await db
    .update(assets)
    .set({
      visibility: "restricted",
      accessPermission,
      // Mesma URL de asset não público (rota autorizada) — asset-url.ts.
      url: sql`${`${MEDIA_ASSET_ROUTE}/`} || ${assets.id}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(assets.categoryId, categoryIds),
        isNull(assets.deletedAt),
        or(ne(assets.visibility, "restricted"), isNull(assets.accessPermission), ne(assets.accessPermission, accessPermission)),
      ),
    )
    .returning({ id: assets.id });
  return rows.length;
}
