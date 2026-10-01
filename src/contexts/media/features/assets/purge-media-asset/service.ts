import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { storagePort } from "@/infrastructure/storage";
import { beginOperation, endOperation } from "@/observability";
import { findSoftDeletedAssetById, hardDeleteAssetById } from "./store";
import { findVariantsByAssetIds } from "../../../shared/asset-variants-store";
import type { PurgeMediaAssetCommand, PurgeMediaAssetResult } from "./types";

const MEDIA_LIST_CACHE_PREFIX = "media:assets:";

// Hard delete real (blob-spec seção 6/7): só age sobre asset já soft-deletado — se o id não
// corresponde a um asset com `deletedAt` preenchido (inexistente, ou ainda ativo), recusa. Não
// checa referência de uso aqui (media não pode depender de cms/brand/academy, regra 12) — quem
// chama isso é platform/media-lifecycle/purge-media-safely.ts (regra 14), que já reconfirma que
// nada referencia o asset antes de chegar até aqui.
export async function purgeMediaAsset(command: PurgeMediaAssetCommand): Promise<PurgeMediaAssetResult> {
  const handle = beginOperation({
    useCase: "media.purge-media-asset",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const asset = await findSoftDeletedAssetById(command.id);
  if (!asset) {
    const error = {
      code: "media.purge.not_deleted",
      message: `Nenhum asset excluído (soft delete) encontrado com id "${command.id}" — só um asset já excluído pode ser apagado definitivamente.`,
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  // Variantes primeiro (a linha delas some junto com o asset, por cascade — depois disso não daria
  // mais pra saber quais objetos apagar).
  for (const variant of await findVariantsByAssetIds([asset.id])) {
    await storagePort.remove(variant.pathname);
  }
  await storagePort.remove(asset.pathname);
  await hardDeleteAssetById(command.id);
  invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);

  endOperation(handle, { success: true });
  return { success: true, data: { id: command.id } };
}
