import { uploadReservedCategoryAsset } from "@/contexts/media";
import type { UploadReservedCategoryAssetInput, UploadReservedCategoryAssetResult } from "@/contexts/media";
import { findRestrictedUploadCategory } from "./apply-restricted-upload-categories";

// Caminho COM SESSÃO exposto a plugins (via @venore/plugin-sdk/media). Antes o SDK reexportava o
// handler cru: arquivo enviado logado numa categoria de manifest.restrictedUploadCategories nascia
// "private" (só o dono lia) e só virava "restricted" no próximo deploy (applyRestrictedUploadCategories
// no prebuild) — quem tinha a permission não enxergava o arquivo de outra pessoa até lá. Mesma
// composição do caminho anônimo (upload-reserved-category-asset-public-gated.ts): a regra vem do
// PLUGIN_REGISTRY, que contexts não podem ler (regra 12).
export async function uploadReservedCategoryAssetGated(
  input: UploadReservedCategoryAssetInput,
): Promise<UploadReservedCategoryAssetResult> {
  const restricted = findRestrictedUploadCategory(input.categoryKey);
  return uploadReservedCategoryAsset(input, restricted ? { accessPermission: restricted.accessPermission } : undefined);
}
