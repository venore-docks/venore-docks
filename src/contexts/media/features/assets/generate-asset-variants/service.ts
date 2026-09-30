import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { storagePort } from "@/infrastructure/storage";
import { beginOperation, endOperation } from "@/observability";
import { MEDIA_VARIANT_CONTENT_TYPE, encodeImageVariants, supportsImageVariants, variantPathname } from "../../../image-variants";
import { findVariantsByAssetIds, insertVariants, type AssetVariantRow } from "../../../shared/asset-variants-store";
import { findVariantSourceAsset, markVariantsProcessed } from "./store";
import type { GenerateAssetVariantsCommand, GenerateAssetVariantsResult } from "./types";

const MEDIA_LIST_CACHE_PREFIX = "media:assets:";

// Gera e grava as cópias WebP redimensionadas de um asset de imagem (image-variants.ts). Chamado
// logo depois de todo upload de imagem e pelo backfill do /admin/media. Sem autorização aqui: só
// roda sobre asset que já existe, e quem chama já passou pelo gate do upload/backfill.
//
// Nunca derruba o upload: qualquer falha vira `success: false` (registrado em observability) e o
// asset segue servindo o original — o backfill tenta de novo depois.
export async function generateAssetVariants(command: GenerateAssetVariantsCommand): Promise<GenerateAssetVariantsResult> {
  const handle = beginOperation({
    useCase: "media.generate-asset-variants",
    actor: { id: "system", type: "system" },
    kind: "write",
  });

  try {
    const asset = await findVariantSourceAsset(command.assetId);
    if (!asset) {
      endOperation(handle, { success: true });
      return { success: true, data: { generated: 0, skipped: true } };
    }
    if (!supportsImageVariants(asset.contentType)) {
      await markVariantsProcessed(asset, null);
      endOperation(handle, { success: true });
      return { success: true, data: { generated: 0, skipped: true } };
    }

    let data = command.data;
    if (!data) {
      const object = await storagePort.read(asset.pathname);
      if (!object) {
        const error = { code: "media.variants.source_missing", message: `Original "${asset.pathname}" não encontrado no storage.` };
        endOperation(handle, { success: false, error });
        return { success: false, error };
      }
      data = Buffer.from(await new Response(object.body).arrayBuffer());
    }

    const encoded = await encodeImageVariants(data, asset.contentType);
    if (!encoded) {
      await markVariantsProcessed(asset, null);
      endOperation(handle, { success: true });
      return { success: true, data: { generated: 0, skipped: true } };
    }

    const existingWidths = new Set((await findVariantsByAssetIds([asset.id])).map((row) => row.width));
    const rows: AssetVariantRow[] = [];
    for (const variant of encoded.variants) {
      if (existingWidths.has(variant.width)) continue;
      const pathname = variantPathname(asset.pathname, variant.width);
      // allowOverwrite: se uma tentativa anterior gravou o objeto e caiu antes do insert, a key já
      // existe — o conteúdo é determinístico, regravar é seguro.
      const stored = await storagePort.store({
        key: pathname,
        data: variant.data,
        contentType: MEDIA_VARIANT_CONTENT_TYPE,
        allowOverwrite: true,
      });
      rows.push({
        assetId: asset.id,
        width: variant.width,
        height: variant.height,
        pathname: stored.key,
        contentType: MEDIA_VARIANT_CONTENT_TYPE,
        size: stored.size,
      });
    }
    await insertVariants(rows);
    await markVariantsProcessed(asset, { width: encoded.width, height: encoded.height });
    if (rows.length > 0) invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);

    endOperation(handle, { success: true });
    return { success: true, data: { generated: rows.length, skipped: rows.length === 0 } };
  } catch (cause) {
    const error = {
      code: "media.variants.failed",
      message: cause instanceof Error ? cause.message : "Falha ao gerar as variantes da imagem.",
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
}
