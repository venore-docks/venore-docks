import { uploadReservedCategoryAsset } from "./service";
import type { UploadReservedCategoryAssetInput, UploadReservedCategoryAssetResult } from "./types";
import { validateReservedCategoryUploadInput } from "./validate-input";

// Variante SEM sessão de uploadReservedCategoryAssetHandler — pra fluxo público que não pode
// exigir login (ex: candidato anexando currículo numa vaga, antes de existir qualquer conta).
// Sempre "private" + uploadedBy null (ver database/schema/index.ts), nunca a biblioteca geral.
// Quem chama assume a responsabilidade por não deixar isso virar upload arbitrário — mesma
// validação de tipo/tamanho do handler autenticado, sem bypass de MEDIA_ALLOWED_TYPES.
export async function uploadReservedCategoryAssetPublicHandler(
  input: UploadReservedCategoryAssetInput,
): Promise<UploadReservedCategoryAssetResult> {
  const validationError = validateReservedCategoryUploadInput(input);
  if (validationError) return validationError;

  return uploadReservedCategoryAsset({ ...input, actorId: null });
}
