import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { storagePort } from "@/infrastructure/storage";
import { computeSha256Hex } from "@/infrastructure/storage/checksum";
import { beginOperation, endOperation } from "@/observability";
import { normalizeImageOriginal, normalizedFilename, supportsOriginalNormalization } from "../../../image-original";
import { findOriginalSourceAsset, updateNormalizedOriginal } from "./store";
import type { NormalizeAssetOriginalCommand, NormalizeAssetOriginalResult } from "./types";

const MEDIA_LIST_CACHE_PREFIX = "media:assets:";

// Versão "depois do upload" do ajuste de original (image-original.ts), pro upload direto ao Blob:
// os bytes nunca passaram pelo servidor, então lê do storage, ajusta e regrava NA MESMA key.
//
// Mesma key de propósito, mesmo quando o HEIC vira JPEG (a key segue terminando em .heic, servida
// como image/jpeg): o registro é idempotente por pathname (confirmação do browser + webhook do
// Blob chegam juntos), e trocar a key quebraria a segunda chamada. A URL também não muda, então
// quem já recebeu o asset continua apontando pro arquivo certo. Só o `filename` exibido ganha .jpg.
//
// Chamado só por quem acabou de inserir a linha (registerUploadedMedia, ramo `inserted`) — a
// unicidade do pathname garante que um único processo faz isso por asset. Nunca derruba o
// registro: falha vira `success: false` e o asset segue com o original como veio.
export async function normalizeAssetOriginal(command: NormalizeAssetOriginalCommand): Promise<NormalizeAssetOriginalResult> {
  const handle = beginOperation({
    useCase: "media.normalize-asset-original",
    actor: { id: "system", type: "system" },
    kind: "write",
  });

  try {
    const asset = await findOriginalSourceAsset(command.assetId);
    if (!asset || !supportsOriginalNormalization(asset.contentType)) {
      endOperation(handle, { success: true });
      return { success: true, data: { changed: false, data: null } };
    }

    const object = await storagePort.read(asset.pathname);
    if (!object) {
      const error = { code: "media.original.source_missing", message: `Original "${asset.pathname}" não encontrado no storage.` };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
    const data = Buffer.from(await new Response(object.body).arrayBuffer());

    const normalized = await normalizeImageOriginal(data, asset.contentType);
    if (!normalized) {
      endOperation(handle, { success: true });
      return { success: true, data: { changed: false, data } };
    }

    const stored = await storagePort.store({
      key: asset.pathname,
      data: normalized.data,
      contentType: normalized.contentType,
      allowOverwrite: true,
    });
    await updateNormalizedOriginal(asset.id, {
      filename: normalizedFilename(asset.filename, asset.contentType, normalized.contentType),
      contentType: normalized.contentType,
      size: stored.size,
      checksum: computeSha256Hex(normalized.data),
      width: normalized.width,
      height: normalized.height,
    });
    invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);

    endOperation(handle, { success: true });
    return { success: true, data: { changed: true, data: normalized.data } };
  } catch (cause) {
    const error = {
      code: "media.original.failed",
      message: cause instanceof Error ? cause.message : "Falha ao ajustar o original da imagem.",
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
}
