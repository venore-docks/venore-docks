import { uploadReservedCategoryAssetPublicUngated } from "@/contexts/media";
import type { UploadReservedCategoryAssetInput, UploadReservedCategoryAssetResult } from "@/contexts/media";
import { isAnonymousUploadCategoryAllowed } from "@/platform/plugin-engine/is-anonymous-upload-category-allowed";

// Único caminho de upload SEM SESSÃO exposto a plugins (via @venore/plugin-sdk/media) — composto
// aqui, fora de contexts/media, porque a checagem depende do PLUGIN_REGISTRY (regra 12: contexts
// não podem conhecer isso, só platform/). uploadReservedCategoryAssetPublicUngated (o handler cru
// do context) nunca é reexportado pro SDK — sem essa gate, categoryKey seria uma string livre que
// qualquer plugin poderia inventar, e upload anônimo viraria um buraco genérico na plataforma.
export async function uploadReservedCategoryAssetPublicGated(
  input: UploadReservedCategoryAssetInput,
): Promise<UploadReservedCategoryAssetResult> {
  const allowed = await isAnonymousUploadCategoryAllowed(input.categoryKey);
  if (!allowed) {
    return {
      success: false,
      error: {
        code: "media.reserved_upload.category_not_allowed",
        message: "Esta categoria não está autorizada a receber envio sem login.",
      },
    };
  }

  return uploadReservedCategoryAssetPublicUngated(input);
}
