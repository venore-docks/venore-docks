// Único sistema de mídia do projeto (docs/implementation-roadmap.md, Fase 4/M1-M3) — `files`
// (storage local em disco) foi descontinuado, tudo passa por `assets`+Vercel Blob
// (docs/media/blob-spec.md).
export { uploadMediaAssetHandler as uploadMediaAsset } from "./features/assets/upload-media-asset/handler";
// Aberto a qualquer ator autenticado (sem media.manage) — só pra imagem de avatar do próprio
// perfil, sempre privada, sempre < AVATAR_MAX_SIZE_BYTES, sempre na categoria reservada
// "avatars". Não usar pra biblioteca geral.
export { uploadAvatarMediaAssetHandler as uploadAvatarMediaAsset } from "./features/assets/upload-avatar-media-asset/handler";
// Upload do PRÓPRIO arquivo do ator numa categoria reservada nomeada pelo plugin (entregas,
// anexos...) — sempre private, nunca a biblioteca geral. Genérico: substitui os antigos
// upload-activity-submission / upload-ticket-attachment que viviam aqui.
export { uploadReservedCategoryAssetHandler as uploadReservedCategoryAsset } from "./features/assets/upload-reserved-category-asset/handler";
export type {
  UploadReservedCategoryAssetInput,
  UploadReservedCategoryAssetResult,
} from "./features/assets/upload-reserved-category-asset/types";
export { listMediaAssetsHandler as listMediaAssets } from "./features/assets/list-media-assets/handler";
export { getMediaAssetHandler as getMediaAsset } from "./features/assets/get-media-asset/handler";
// BYPASS deliberado de visibilidade — só pra service que já verificou a própria autorização pro
// recurso específico (ex: revisão de um upload privado feito por outro ator). Nunca chamar isto a
// partir de UI/action que não tenha checado permissão antes. Ver comentário em
// features/assets/get-media-asset/service.ts.
export { getMediaAssetForTrustedReview } from "./features/assets/get-media-asset/service";
// Não checa se o arquivo está em uso por uma entry de cms — media não pode depender de cms
// (fecharia ciclo com a validação de mediaId em create-entry/update-entry, regra 11). Quem
// precisa dessa garantia deve chamar platform/media-lifecycle/delete-media-safely.ts, não este
// export direto (regra 14 — segunda ocorrência do padrão, primeira foi o registro de usuário).
export { deleteMediaAssetHandler as deleteMediaAsset } from "./features/assets/delete-media-asset/handler";
// Hard delete real (blob-spec seção 6/7) — só age sobre asset já soft-deletado, atrás de
// media.purge (diferente de media.manage, que cobre deleteMediaAsset). Mesma regra 14 de
// deleteMediaAsset: quem precisa reconfirmar ausência de uso antes de apagar de vez deve chamar
// platform/media-lifecycle/purge-media-safely.ts, não este export direto.
export { purgeMediaAssetHandler as purgeMediaAsset } from "./features/assets/purge-media-asset/handler";
export { listDeletedMediaAssetsHandler as listDeletedMediaAssets } from "./features/assets/list-deleted-media-assets/handler";
// Consumida por platform/identity-lifecycle/purge-user-safely.ts — mesma composição fora de media
// e auth (auth não pode importar media).
export { countAssetsByUploaderHandler as countAssetsByUploader } from "./features/assets/count-assets-by-uploader/handler";
export type {
  CountAssetsByUploaderQuery,
  CountAssetsByUploaderResult,
} from "./features/assets/count-assets-by-uploader/types";
// Exports "de sistema" (sem authorizeActor) — só pro sweep de autopurge
// (platform/media-lifecycle/sweep-soft-deleted-media.ts), que roda como processo de sistema, sem
// ator humano por trás (mesmo raciocínio de getMediaAssetForTrustedReview acima e
// validateMediaUploadCandidate abaixo). Nunca chamar a partir de uma action de UI.
export { listSoftDeletedAssetsOlderThan } from "./features/assets/list-deleted-media-assets/service";
export { purgeMediaAsset as purgeMediaAssetAsSystem } from "./features/assets/purge-media-asset/service";
// Editável por dono OU media.manage — diferente de deleteMediaAsset, que é binário só-media.manage.
export {
  updateMediaAssetVisibilityHandler as updateMediaAssetVisibility,
} from "./features/assets/update-media-asset-visibility/handler";
export {
  updateMediaAssetCategoryHandler as updateMediaAssetCategory,
} from "./features/assets/update-media-asset-category/handler";

export { listCategoriesHandler as listCategories } from "./features/categories/list-categories/handler";
export { createCategoryHandler as createCategory } from "./features/categories/create-category/handler";
export { updateCategoryHandler as updateCategory } from "./features/categories/update-category/handler";
// Bloqueia se algum asset ainda usa a categoria — quem chama decide entre desvincular em massa
// (clearCategoryAssets) ou recategorizar cada arquivo antes de tentar de novo.
export { deleteCategoryHandler as deleteCategory } from "./features/categories/delete-category/handler";
export { clearCategoryAssetsHandler as clearCategoryAssets } from "./features/categories/clear-category-assets/handler";

// Fluxo de client-upload direto ao Blob (docs/media/blob-spec.md) — necessário pra arquivos que
// excedem o limite de body de uma function (vídeo, principalmente). `confirmMediaUpload` é a
// entrada pública para a confirmação feita pelo browser depois que upload() resolve — o handler
// de baixo nível usado pelo webhook onUploadCompleted (que confia num actorId já resolvido via
// tokenPayload) não é exportado aqui de propósito, só a rota o importa direto.
export { requestMediaUploadTicketHandler as requestMediaUploadTicket } from "./features/assets/request-media-upload-ticket/handler";
// Exposta pro route handler revalidar allowlist/limite dentro de onBeforeGenerateToken sem
// duplicar a regra (blob-spec seção 5, "checado duas vezes").
export { validateMediaUploadCandidate, assertTypeAllowedForDirectUpload } from "./features/assets/request-media-upload-ticket/service";
export { confirmMediaUploadHandler as confirmMediaUpload } from "./features/assets/register-uploaded-media/handler";

// Import só pelo efeito colateral: dispara o auto-start da varredura de reconciliação de upload
// órfão (Fase 4/M2) na primeira vez que qualquer coisa importar o barrel do media — mesmo
// mecanismo de cms/index.ts importar ./scheduling.
import "./reconciliation";

export { mediaAdminNavigationItems } from "./admin-navigation";
export { mediaBreadcrumbSegments, getCachedMedia } from "./breadcrumbs";

export type { MediaAsset, MediaAssetCategory, MediaAllowedTypeRule, MediaCategory, MediaVisibility } from "./contracts/types";
export { MEDIA_ALLOWED_TYPES, AVATAR_MAX_SIZE_BYTES } from "./contracts/types";

export type { UploadMediaAssetInput, UploadMediaAssetResult } from "./features/assets/upload-media-asset/types";
export type { UploadAvatarMediaAssetInput, UploadAvatarMediaAssetResult } from "./features/assets/upload-avatar-media-asset/types";
export type { ListMediaAssetsQuery, ListMediaAssetsResult } from "./features/assets/list-media-assets/types";
export type { GetMediaAssetQuery, GetMediaAssetResult } from "./features/assets/get-media-asset/types";
export type { DeleteMediaAssetInput, DeleteMediaAssetResult } from "./features/assets/delete-media-asset/types";
export type { PurgeMediaAssetInput, PurgeMediaAssetResult } from "./features/assets/purge-media-asset/types";
export type { ListDeletedMediaAssetsResult } from "./features/assets/list-deleted-media-assets/types";
export type {
  UpdateMediaAssetVisibilityInput,
  UpdateMediaAssetVisibilityResult,
} from "./features/assets/update-media-asset-visibility/types";
export type {
  UpdateMediaAssetCategoryInput,
  UpdateMediaAssetCategoryResult,
} from "./features/assets/update-media-asset-category/types";

export type { ListCategoriesResult } from "./features/categories/list-categories/types";
export type { CreateCategoryResult } from "./features/categories/create-category/types";
export type { CreateCategoryHandlerInput } from "./features/categories/create-category/handler";
export type { UpdateCategoryResult } from "./features/categories/update-category/types";
export type { UpdateCategoryHandlerInput } from "./features/categories/update-category/handler";
export type { DeleteCategoryInput, DeleteCategoryResult } from "./features/categories/delete-category/types";
export type { ClearCategoryAssetsInput, ClearCategoryAssetsResult } from "./features/categories/clear-category-assets/types";

export type {
  RequestMediaUploadTicketInput,
  RequestMediaUploadTicketResult,
  MediaUploadTicket,
} from "./features/assets/request-media-upload-ticket/types";
export type { RegisterUploadedMediaResult } from "./features/assets/register-uploaded-media/types";
export type { ConfirmMediaUploadInput } from "./features/assets/register-uploaded-media/handler";
