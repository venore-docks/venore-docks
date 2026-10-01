import { attachAssetVariantsToOne } from "../../../shared/attach-asset-variants";
import { resolveMediaActorScope } from "../../../resolve-media-actor-scope";
import { getMediaAsset } from "./service";
import { findPublicAssetById } from "./store";
import type { GetMediaAssetQuery, GetMediaAssetResult } from "./types";

export async function getMediaAssetHandler(query: GetMediaAssetQuery): Promise<GetMediaAssetResult> {
  const scope = await resolveMediaActorScope();
  if (!scope) {
    // Visitante sem sessão ainda enxerga asset "public" (páginas públicas: blogroll, home,
    // institucionais) — só isso, nunca "private"/"restricted" (ver findPublicAssetById).
    const media = await findPublicAssetById(query.id);
    return { success: true, data: await attachAssetVariantsToOne(media) };
  }

  return getMediaAsset(query, scope);
}
