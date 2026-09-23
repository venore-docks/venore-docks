// Lista explícita (não `export * from "@/contexts/media"`) de propósito: o barrel do context
// também exporta uploadReservedCategoryAssetPublicUngated (upload sem sessão, sem gate de
// categoria — ver comentário lá) só pra platform/media-lifecycle/upload-reserved-category-asset-
// public-gated.ts conseguir chamá-lo através do barrel (regra 12). Um `export *` aqui vazaria
// esse nome pro SDK igual a qualquer outro, e qualquer plugin poderia chamar upload anônimo pra
// QUALQUER categoryKey inventada — a wildcard export re-exporta tudo, inclusive o que não deve
// alcançar plugin nenhum. Mantendo a lista explícita, o único jeito de plugin fazer upload sem
// sessão é uploadReservedCategoryAssetPublic (abaixo), que É gateado por
// manifest.anonymousUploadCategories.
export {
  uploadMediaAsset,
  uploadAvatarMediaAsset,
  uploadReservedCategoryAsset,
  listMediaAssets,
  getMediaAsset,
  getMediaAssetForTrustedReview,
  deleteMediaAsset,
  purgeMediaAsset,
  listDeletedMediaAssets,
  countAssetsByUploader,
  listSoftDeletedAssetsOlderThan,
  purgeMediaAssetAsSystem,
  updateMediaAssetVisibility,
  updateMediaAssetCategory,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  clearCategoryAssets,
  requestMediaUploadTicket,
  validateMediaUploadCandidate,
  assertTypeAllowedForDirectUpload,
  confirmMediaUpload,
  mediaAdminNavigationItems,
  mediaBreadcrumbSegments,
  getCachedMedia,
  MEDIA_ALLOWED_TYPES,
  AVATAR_MAX_SIZE_BYTES,
} from "@/contexts/media";
export type {
  MediaAsset,
  MediaAssetCategory,
  MediaAllowedTypeRule,
  MediaCategory,
  MediaVisibility,
  UploadMediaAssetInput,
  UploadMediaAssetResult,
  UploadAvatarMediaAssetInput,
  UploadAvatarMediaAssetResult,
  UploadReservedCategoryAssetInput,
  UploadReservedCategoryAssetResult,
  ListMediaAssetsQuery,
  ListMediaAssetsResult,
  GetMediaAssetQuery,
  GetMediaAssetResult,
  DeleteMediaAssetInput,
  DeleteMediaAssetResult,
  PurgeMediaAssetInput,
  PurgeMediaAssetResult,
  ListDeletedMediaAssetsResult,
  CountAssetsByUploaderQuery,
  CountAssetsByUploaderResult,
  UpdateMediaAssetVisibilityInput,
  UpdateMediaAssetVisibilityResult,
  UpdateMediaAssetCategoryInput,
  UpdateMediaAssetCategoryResult,
  ListCategoriesResult,
  CreateCategoryResult,
  CreateCategoryHandlerInput,
  UpdateCategoryResult,
  UpdateCategoryHandlerInput,
  DeleteCategoryInput,
  DeleteCategoryResult,
  ClearCategoryAssetsInput,
  ClearCategoryAssetsResult,
  RequestMediaUploadTicketInput,
  RequestMediaUploadTicketResult,
  MediaUploadTicket,
  RegisterUploadedMediaResult,
  ConfirmMediaUploadInput,
} from "@/contexts/media";

// Fica aqui (não no index) porque puxa media-usage-registry -> @/plugins/contributions: só um
// plugin que importa explicitamente "@venore/plugin-sdk/media" paga esse grafo, sem ciclo com o
// contributions.ts dos plugins que só usam o entry raiz.
export { deleteMediaSafely, type DeleteMediaSafelyInput } from "@/platform/media-lifecycle/delete-media-safely";

// Upload SEM SESSÃO — único caminho pro plugin aceitar arquivo de quem ainda não tem conta (ex:
// currículo de candidatura em vagas). Gateado por manifest.anonymousUploadCategories: o plugin
// declara pra quais categoryKey PRÓPRIAS isso vale, senão devolve category_not_allowed. Ver
// platform/media-lifecycle/upload-reserved-category-asset-public-gated.ts.
export {
  uploadReservedCategoryAssetPublicGated as uploadReservedCategoryAssetPublic,
} from "@/platform/media-lifecycle/upload-reserved-category-asset-public-gated";
