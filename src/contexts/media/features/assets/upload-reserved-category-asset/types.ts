import type { OperationResult } from "@/shared/types";
import type { MediaAsset } from "../../../contracts/types";

// Upload de um arquivo do PRÓPRIO ator (sempre "private") numa categoria RESERVADA nomeada pelo
// chamador — para plugins que têm um caixote de sistema próprio (entregas de atividade, anexos de
// chamado etc.). Não é a biblioteca geral (essa é upload-media-asset, atrás de media.manage). A
// leitura por quem revisa passa por getMediaAssetForTrustedReview (bypass de visibilidade), nunca
// pela leitura escopada normal.
export type UploadReservedCategoryAssetInput = {
  filename: string;
  contentType: string;
  size: number;
  data: Buffer;
  // Categoria reservada de destino — o plugin escolhe a key/label do seu próprio caixote.
  categoryKey: string;
  categoryName: string;
  // Categorias de MIME permitidas (as chaves `category` de MEDIA_ALLOWED_TYPES: "image",
  // "audio", "video", "document"). Ausente = qualquer tipo de MEDIA_ALLOWED_TYPES.
  allowedMimeCategories?: string[];
};
// actorId nullable — uploadReservedCategoryAssetPublicHandler (sem sessão) chama com null pra
// envio anônimo de um plugin público (ex: currículo de candidatura em vagas).
export type UploadReservedCategoryAssetCommand = UploadReservedCategoryAssetInput & { actorId: string | null };
export type UploadReservedCategoryAssetResult = OperationResult<MediaAsset>;
