import { MEDIA_ALLOWED_TYPES } from "../../../contracts/types";
import type { UploadReservedCategoryAssetInput, UploadReservedCategoryAssetResult } from "./types";

// Regra de tipo/tamanho compartilhada entre o handler autenticado (upload-reserved-category-
// asset) e o público (upload-reserved-category-asset-public) — só isso muda entre os dois, o
// resto (getCurrentUser) é específico de cada handler.
export function validateReservedCategoryUploadInput(
  input: UploadReservedCategoryAssetInput,
): Extract<UploadReservedCategoryAssetResult, { success: false }> | null {
  if (input.filename.trim().length === 0) {
    return { success: false, error: { code: "media.upload.invalid_filename", message: "O nome do arquivo não pode ser vazio." } };
  }

  const rule = MEDIA_ALLOWED_TYPES[input.contentType];
  const categoryOk = rule && (!input.allowedMimeCategories || input.allowedMimeCategories.includes(rule.category));
  if (!rule || !categoryOk) {
    return {
      success: false,
      error: { code: "media.reserved_upload.invalid_mime_type", message: "Tipo de arquivo não permitido para este envio." },
    };
  }

  if (input.size <= 0) {
    return { success: false, error: { code: "media.upload.invalid_size", message: "O tamanho do arquivo deve ser maior que zero." } };
  }
  if (input.size > rule.maxSizeBytes) {
    return {
      success: false,
      error: {
        code: "media.upload.file_too_large",
        message: `O arquivo excede o limite de ${Math.floor(rule.maxSizeBytes / (1024 * 1024))}MB para o tipo "${input.contentType}".`,
      },
    };
  }

  return null;
}
