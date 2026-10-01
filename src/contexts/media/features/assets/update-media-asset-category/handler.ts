import { resolveMediaActorScope } from "../../../resolve-media-actor-scope";
import { updateMediaAssetCategory } from "./service";
import type { UpdateMediaAssetCategoryInput, UpdateMediaAssetCategoryResult } from "./types";

export async function updateMediaAssetCategoryHandler(input: UpdateMediaAssetCategoryInput): Promise<UpdateMediaAssetCategoryResult> {
  const scope = await resolveMediaActorScope();
  if (!scope) {
    return {
      success: false,
      error: { code: "media.not_found", message: `Nenhum arquivo de mídia encontrado com id "${input.id}".` },
    };
  }

  return updateMediaAssetCategory({ ...input, actorId: scope.actorId, isMediaAdmin: scope.isMediaAdmin, isSuperadmin: scope.isSuperadmin });
}
