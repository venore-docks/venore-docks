import { resolveAssetVariantUrl } from "../../../asset-url";
import { canReadAsset } from "../../../shared/can-read-asset";
import type { MediaAssetVariant } from "../../../contracts/types";
import { findVariantsByAssetIds } from "../../../shared/asset-variants-store";
import { pickMediaVariantUrl } from "../../../variant-selection";
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
  const visibleRows = rows.filter((row) => canReadAsset(row, scope));

  const variantsByAsset = new Map<string, MediaAssetVariant[]>();
  if (query.displayWidth && visibleRows.length > 0) {
    const rowById = new Map(visibleRows.map((row) => [row.id, row]));
    for (const variant of await findVariantsByAssetIds([...rowById.keys()])) {
      const list = variantsByAsset.get(variant.assetId) ?? [];
      list.push({ ...variant, url: resolveAssetVariantUrl(rowById.get(variant.assetId)!, variant) });
      variantsByAsset.set(variant.assetId, list);
    }
  }

  const urls: Record<string, string> = {};
  for (const row of visibleRows) {
    urls[row.id] = pickMediaVariantUrl({ url: row.url, variants: variantsByAsset.get(row.id) }, query.displayWidth);
  }
  return { success: true, data: urls };
}
