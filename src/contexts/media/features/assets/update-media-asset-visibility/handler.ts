import { resolveMediaActorScope } from "../../../resolve-media-actor-scope";
import { updateMediaAssetVisibility } from "./service";
import type { UpdateMediaAssetVisibilityInput, UpdateMediaAssetVisibilityResult } from "./types";

export async function updateMediaAssetVisibilityHandler(input: UpdateMediaAssetVisibilityInput): Promise<UpdateMediaAssetVisibilityResult> {
  const scope = await resolveMediaActorScope();
  if (!scope) {
    return {
      success: false,
      error: { code: "media.not_found", message: `Nenhum arquivo de mídia encontrado com id "${input.id}".` },
    };
  }

  return updateMediaAssetVisibility({ ...input, actorId: scope.actorId, isMediaAdmin: scope.isMediaAdmin, isSuperadmin: scope.isSuperadmin });
}
