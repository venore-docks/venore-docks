import { resolveAssetVariantUrl } from "../asset-url";
import type { MediaAsset, MediaAssetVariant } from "../contracts/types";
import { findVariantsByAssetIds } from "./asset-variants-store";

// Preenche `variants` (menor primeiro) numa lista de assets com uma query só — usado por
// getMediaAsset/listMediaAssets. A URL sai da visibilidade atual do asset (resolveAssetVariantUrl).
export async function attachAssetVariants<T extends MediaAsset>(assets: T[]): Promise<T[]> {
  if (assets.length === 0) return assets;
  const rows = await findVariantsByAssetIds(assets.map((asset) => asset.id));
  const byAsset = new Map<string, MediaAssetVariant[]>();
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const row of rows) {
    const asset = assetById.get(row.assetId);
    if (!asset) continue;
    const list = byAsset.get(row.assetId) ?? [];
    list.push({
      width: row.width,
      height: row.height,
      size: row.size,
      contentType: row.contentType,
      url: resolveAssetVariantUrl(asset, row),
    });
    byAsset.set(row.assetId, list);
  }
  return assets.map((asset) => ({ ...asset, variants: byAsset.get(asset.id) ?? [] }));
}

export async function attachAssetVariantsToOne<T extends MediaAsset>(asset: T | null): Promise<T | null> {
  if (!asset) return null;
  const [withVariants] = await attachAssetVariants([asset]);
  return withVariants;
}
