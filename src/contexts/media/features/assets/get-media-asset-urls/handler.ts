// Sem authorizeActor: leitura com recorte por visibilidade (mesmo critério de get-media-asset),
// usada por páginas públicas.
import { resolveMediaActorScope } from "../../../resolve-media-actor-scope";
import { getMediaAssetUrls } from "./service";
import type { GetMediaAssetUrlsQuery, GetMediaAssetUrlsResult } from "./types";

export async function getMediaAssetUrlsHandler(query: GetMediaAssetUrlsQuery): Promise<GetMediaAssetUrlsResult> {
  const scope = await resolveMediaActorScope();
  return getMediaAssetUrls(query, scope);
}
