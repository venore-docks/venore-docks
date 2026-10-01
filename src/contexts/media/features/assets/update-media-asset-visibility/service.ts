import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { canManageAsset } from "../../../shared/can-read-asset";
import { resolveAssetUrl } from "../../../asset-url";
import { findAssetById, updateAssetVisibility } from "./store";
import type { UpdateMediaAssetVisibilityCommand, UpdateMediaAssetVisibilityResult } from "./types";

const MEDIA_LIST_CACHE_PREFIX = "media:assets:";

// "Não encontrado" cobre tanto arquivo inexistente quanto ator sem direito de editar (nem dono,
// nem media.manage) — nunca confirma pra quem pergunta que um asset privado de outro ator existe.
export async function updateMediaAssetVisibility(command: UpdateMediaAssetVisibilityCommand): Promise<UpdateMediaAssetVisibilityResult> {
  const media = await findAssetById(command.id);
  // Asset "restricted" (currículo etc.) só muda pelo superadmin — media.manage não pode torná-lo
  // público nem tirá-lo da categoria do plugin (shared/can-read-asset.ts).
  const canEdit =
    media !== null &&
    canManageAsset(media, { actorId: command.actorId, isMediaAdmin: command.isMediaAdmin, isSuperadmin: command.isSuperadmin ?? false });

  if (!canEdit) {
    return {
      success: false,
      error: { code: "media.not_found", message: `Nenhum arquivo de mídia encontrado com id "${command.id}".` },
    };
  }

  // A URL acompanha a visibilidade: tornar privado troca a URL direta do storage pela rota
  // autorizada (e vice-versa). Cópias já baixadas/cacheadas da URL antiga não são revogadas.
  const url = resolveAssetUrl({ id: media.id, pathname: media.pathname, visibility: command.visibility });
  const updated = await updateAssetVisibility(command.id, command.visibility, url);
  invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);

  return { success: true, data: updated };
}
