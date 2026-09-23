import { getCurrentUser } from "@/contexts/auth";
import { uploadReservedCategoryAsset } from "./service";
import type { UploadReservedCategoryAssetInput, UploadReservedCategoryAssetResult } from "./types";
import { validateReservedCategoryUploadInput } from "./validate-input";

// Qualquer ator autenticado envia o PRÓPRIO arquivo (sem media.manage) — a autorização de negócio
// (matrícula, acesso ao chamado etc.) é do plugin chamador, antes/depois. Aqui só: autenticado +
// tipo/tamanho dentro de MEDIA_ALLOWED_TYPES (e da lista `allowedMimeCategories` do chamador).
export async function uploadReservedCategoryAssetHandler(
  input: UploadReservedCategoryAssetInput,
): Promise<UploadReservedCategoryAssetResult> {
  const validationError = validateReservedCategoryUploadInput(input);
  if (validationError) return validationError;

  const currentUser = await getCurrentUser();
  if (!currentUser.success || !currentUser.data) {
    return {
      success: false,
      error: { code: "media.reserved_upload.unauthenticated", message: "É necessário estar autenticado para executar esta operação." },
    };
  }

  return uploadReservedCategoryAsset({ ...input, actorId: currentUser.data.id });
}
