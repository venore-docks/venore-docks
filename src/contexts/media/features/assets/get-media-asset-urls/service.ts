import type { MediaActorScope } from "../../../resolve-media-actor-scope";
import { findAssetUrlsByIds } from "./store";
import type { GetMediaAssetUrlsQuery, GetMediaAssetUrlsResult } from "./types";

const MAX_IDS = 200;

// Mesma regra de visibilidade de getMediaAsset: sem sessão só "public"; com sessão, público +
// os próprios + tudo pra media.manage. Id sem permissão ou inexistente simplesmente não aparece.
export async function getMediaAssetUrls(query: GetMediaAssetUrlsQuery, scope: MediaActorScope | null): Promise<GetMediaAssetUrlsResult> {
  const ids = [...new Set(query.ids.filter(Boolean))];
  if (ids.length === 0) return { success: true, data: {} };
  if (ids.length > MAX_IDS) {
    return { success: false, error: { code: "media.too_many_ids", message: `No máximo ${MAX_IDS} arquivos por consulta.` } };
  }

  const rows = await findAssetUrlsByIds(ids);
  const urls: Record<string, string> = {};
  for (const row of rows) {
    const visible =
      row.visibility === "public" ||
      (scope !== null && (scope.isMediaAdmin || (row.uploadedBy !== null && row.uploadedBy === scope.actorId)));
    if (visible) urls[row.id] = row.url;
  }
  return { success: true, data: urls };
}
