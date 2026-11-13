// Sem authorizeActor: leitura com recorte por visibilidade (mesmo critério de get-media-asset),
// usada por páginas públicas.
import { resolveMediaActorScope } from "../../../resolve-media-actor-scope";
import { getMediaAssetImages, getMediaAssetUrls } from "./service";
import type { GetMediaAssetImagesResult, GetMediaAssetUrlsQuery, GetMediaAssetUrlsResult } from "./types";

export async function getMediaAssetUrlsHandler(query: GetMediaAssetUrlsQuery): Promise<GetMediaAssetUrlsResult> {
  const scope = await resolveMediaActorScope();
  return getMediaAssetUrls(query, scope);
}

export async function getMediaAssetImagesHandler(query: GetMediaAssetUrlsQuery): Promise<GetMediaAssetImagesResult> {
  const scope = await resolveMediaActorScope();
  return getMediaAssetImages(query, scope);
}
