import { resolveAssetVariantUrl } from "../../../asset-url";
import { canReadAsset } from "../../../shared/can-read-asset";
import type { MediaAssetVariant } from "../../../contracts/types";
import { findVariantsByAssetIds } from "../../../shared/asset-variants-store";
import { pickMediaVariantUrl } from "../../../variant-selection";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";
import { findAssetUrlsByIds } from "./store";
import type { GetMediaAssetImagesResult, GetMediaAssetUrlsQuery, GetMediaAssetUrlsResult, MediaAssetImage } from "./types";

const MAX_IDS = 200;

// Mesma regra de visibilidade de getMediaAsset: sem sessão só "public"; com sessão, público +
// os próprios + tudo pra media.manage. Id sem permissão ou inexistente simplesmente não aparece.
async function resolveAssetImages(
  query: GetMediaAssetUrlsQuery,
  scope: MediaActorScope | null,
): Promise<GetMediaAssetImagesResult> {
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

  const images: Record<string, MediaAssetImage> = {};
  for (const row of visibleRows) {
    images[row.id] = {
      url: pickMediaVariantUrl({ url: row.url, variants: variantsByAsset.get(row.id) }, query.displayWidth),
      // Dimensões do ORIGINAL (variante tem a mesma proporção) — null em upload antigo sem backfill.
      width: row.width ?? null,
      height: row.height ?? null,
    };
  }
  return { success: true, data: images };
}

export async function getMediaAssetUrls(query: GetMediaAssetUrlsQuery, scope: MediaActorScope | null): Promise<GetMediaAssetUrlsResult> {
  const result = await resolveAssetImages(query, scope);
  if (!result.success) return result;
  const urls: Record<string, string> = {};
  for (const [id, image] of Object.entries(result.data)) urls[id] = image.url;
  return { success: true, data: urls };
}

// Igual a getMediaAssetUrls, mas com largura/altura do original — pra quem precisa da proporção
// da imagem (capa de card que não pode cortar arte vertical/quadrada, cover-image.ts).
export async function getMediaAssetImages(query: GetMediaAssetUrlsQuery, scope: MediaActorScope | null): Promise<GetMediaAssetImagesResult> {
  return resolveAssetImages(query, scope);
}
