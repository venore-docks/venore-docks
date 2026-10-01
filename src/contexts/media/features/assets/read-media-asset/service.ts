import { storagePort } from "@/infrastructure/storage";
import { verifyMediaSignature } from "../../../asset-url";
import type { MediaActorScope } from "../../../resolve-media-actor-scope";
import { canReadAsset } from "../../../shared/can-read-asset";
import { findServableAsset, findVariantPathname } from "./store";
import type { ReadMediaAssetQuery, ReadMediaAssetResult } from "./types";

const NOT_FOUND: ReadMediaAssetResult = {
  success: false,
  error: { code: "media.not_found", message: "Arquivo não encontrado." },
};

// Quem pode ler: canReadAsset (público, dono, media.manage em privado, permission do asset em
// restrito) ou quem tem uma URL assinada válida. Negativa é sempre "não encontrado" (não confirma
// que o arquivo existe).
export async function readMediaAsset(query: ReadMediaAssetQuery, scope: MediaActorScope | null): Promise<ReadMediaAssetResult> {
  const asset = await findServableAsset({ id: query.id, pathname: query.pathname });
  if (!asset) return NOT_FOUND;

  const allowed = canReadAsset(asset, scope) || verifyMediaSignature(asset.id, query.exp ?? null, query.sig ?? null);
  if (!allowed) return NOT_FOUND;

  const variantPathname = query.width ? await findVariantPathname(asset.id, query.width) : null;
  const object = await storagePort.read(variantPathname ?? asset.pathname, query.range ?? null);
  if (!object) return NOT_FOUND;

  return { success: true, data: { ...object, visibility: asset.visibility } };
}
