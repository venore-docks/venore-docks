// Sem authorizeActor: o acesso é decidido POR ASSET (visibilidade, dono, URL assinada) no
// service — visitante anônimo lê asset público. Consumido pelas rotas que servem mídia.
import { resolveMediaActorScope } from "../../../resolve-media-actor-scope";
import { readMediaAsset } from "./service";
import type { ReadMediaAssetQuery, ReadMediaAssetResult } from "./types";

export async function readMediaAssetHandler(query: ReadMediaAssetQuery): Promise<ReadMediaAssetResult> {
  if (!query.id && !query.pathname) {
    return { success: false, error: { code: "media.not_found", message: "Arquivo não encontrado." } };
  }
  const scope = await resolveMediaActorScope();
  return readMediaAsset(query, scope);
}
