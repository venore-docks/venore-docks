import { and, asc, desc, eq, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { assets } from "../database/schema";
import type { MediaActorScope } from "../resolve-media-actor-scope";
import type { MediaVisibility } from "../contracts/types";

// Tipo "de biblioteca" (o que o admin enxerga como abas), não o MIME cru: tudo que não é imagem,
// vídeo ou áudio cai em "document" (pdf, planilhas, zips...).
export type MediaKind = "image" | "video" | "audio" | "document";
export const MEDIA_KINDS: readonly MediaKind[] = ["image", "video", "audio", "document"];

export type MediaSort = "newest" | "oldest" | "name" | "size";
export const MEDIA_SORTS: readonly MediaSort[] = ["newest", "oldest", "name", "size"];

// Valor de categoryId que significa "arquivos sem categoria".
export const UNCATEGORIZED_FILTER = "none";

// Biblioteca/picker: arquivo "restricted" (currículo etc.) só aparece pro superadmin e pro dono —
// nunca pra media.manage (shared/can-read-asset.ts). Quem tem a permission do asset o vê na tela
// do próprio plugin, não na biblioteca geral.
export function buildVisibilityScope(scope: MediaActorScope): SQL {
  const notDeleted = isNull(assets.deletedAt);
  if (scope.isSuperadmin) return notDeleted;
  const filter = scope.isMediaAdmin
    ? and(notDeleted, or(ne(assets.visibility, "restricted"), eq(assets.uploadedBy, scope.actorId)))
    : and(notDeleted, or(eq(assets.visibility, "public"), eq(assets.uploadedBy, scope.actorId)));
  return filter as SQL;
}

export function buildKindCondition(kind: MediaKind): SQL {
  switch (kind) {
    case "image":
      return sql`${assets.contentType} LIKE 'image/%'`;
    case "video":
      return sql`${assets.contentType} LIKE 'video/%'`;
    case "audio":
      return sql`${assets.contentType} LIKE 'audio/%'`;
    case "document":
      return sql`${assets.contentType} NOT LIKE 'image/%' AND ${assets.contentType} NOT LIKE 'video/%' AND ${assets.contentType} NOT LIKE 'audio/%'`;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export type AssetListFilters = {
  categoryId?: string;
  search?: string;
  kind?: MediaKind;
  visibility?: MediaVisibility;
};

export function buildAssetFilters(scope: MediaActorScope, filters: AssetListFilters): SQL {
  const conditions: SQL[] = [buildVisibilityScope(scope)];
  if (filters.categoryId === UNCATEGORIZED_FILTER) conditions.push(isNull(assets.categoryId));
  else if (filters.categoryId) conditions.push(eq(assets.categoryId, filters.categoryId));
  const search = filters.search?.trim();
  if (search) conditions.push(ilike(assets.filename, `%${escapeLike(search)}%`));
  if (filters.kind) conditions.push(buildKindCondition(filters.kind));
  if (filters.visibility) conditions.push(eq(assets.visibility, filters.visibility));
  return and(...conditions) as SQL;
}

export function buildAssetOrder(sort: MediaSort = "newest"): SQL[] {
  switch (sort) {
    case "oldest":
      return [asc(assets.createdAt), asc(assets.id)];
    case "name":
      return [asc(sql`lower(${assets.filename})`), asc(assets.id)];
    case "size":
      return [desc(assets.size), asc(assets.id)];
    default:
      return [desc(assets.createdAt), asc(assets.id)];
  }
}
