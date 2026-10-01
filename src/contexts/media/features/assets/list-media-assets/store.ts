import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { assets } from "../../../database/schema";
import type { MediaAsset } from "../../../contracts/types";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";

export async function findAllAssets(
  scope: MediaActorScope,
  categoryId?: string,
  page?: { limit: number; offset: number },
): Promise<MediaAsset[]> {
  const notDeleted = isNull(assets.deletedAt);
  // Biblioteca/picker: arquivo "restricted" (currículo etc.) só aparece pro superadmin e pro dono —
  // nunca pra media.manage (shared/can-read-asset.ts). Quem tem a permission do asset o vê na tela
  // do próprio plugin, não na biblioteca geral.
  const visibilityFilter = scope.isSuperadmin
    ? notDeleted
    : scope.isMediaAdmin
      ? and(notDeleted, or(ne(assets.visibility, "restricted"), eq(assets.uploadedBy, scope.actorId)))
      : and(notDeleted, or(eq(assets.visibility, "public"), eq(assets.uploadedBy, scope.actorId)));

  const filter = categoryId ? and(visibilityFilter, eq(assets.categoryId, categoryId)) : visibilityFilter;

  const query = db.select().from(assets).where(filter).orderBy(desc(assets.createdAt), assets.id);
  const rows = page ? await query.limit(page.limit).offset(page.offset) : await query;
  return rows as MediaAsset[];
}
