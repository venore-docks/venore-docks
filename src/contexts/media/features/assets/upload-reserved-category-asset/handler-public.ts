import { uploadReservedCategoryAsset } from "./service";
import type { UploadReservedCategoryAssetInput, UploadReservedCategoryAssetResult, UploadReservedCategoryRestriction } from "./types";
import { validateReservedCategoryUploadInput } from "./validate-input";

// Variante SEM sessão de uploadReservedCategoryAssetHandler — pra fluxo público que não pode
// exigir login (ex: candidato anexando currículo numa vaga, antes de existir qualquer conta).
// Sempre "private" + uploadedBy null (ver database/schema/index.ts), nunca a biblioteca geral.
// Quem chama assume a responsabilidade por não deixar isso virar upload arbitrário — mesma
// validação de tipo/tamanho do handler autenticado, sem bypass de MEDIA_ALLOWED_TYPES.
// `restriction` vem de platform/media-lifecycle/upload-reserved-category-asset-public-gated.ts
// (manifest.restrictedUploadCategories) — nunca do plugin chamador.
export async function uploadReservedCategoryAssetPublicHandler(
  input: UploadReservedCategoryAssetInput,
  restriction?: UploadReservedCategoryRestriction,
): Promise<UploadReservedCategoryAssetResult> {
  const validationError = validateReservedCategoryUploadInput(input);
  if (validationError) return validationError;

  return uploadReservedCategoryAsset({ ...input, actorId: null, restriction });
}
