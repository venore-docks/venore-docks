import { resolveMediaActorScope } from "../../../resolve-media-actor-scope";
import { listOwnMediaAssets } from "./service";
import type { ListOwnMediaAssetsResult } from "./types";

// Arquivos que a própria pessoa enviou (inclusive na lixeira) — "baixar meus dados".
export async function listOwnMediaAssetsHandler(): Promise<ListOwnMediaAssetsResult> {
  const scope = await resolveMediaActorScope();
  if (!scope) {
    return { success: false, error: { code: "media.unauthenticated", message: "É necessário estar autenticado." } };
  }
  return listOwnMediaAssets(scope.actorId);
}
