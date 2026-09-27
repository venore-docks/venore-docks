import { beginOperation, endOperation } from "@/observability";
import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { storagePort } from "@/infrastructure/storage";
import { computeSha256Hex } from "@/infrastructure/storage/checksum";
import { validateMediaUploadCandidate } from "../request-media-upload-ticket/service";
import { resolveMediaStorageFolder } from "../../../resolve-media-storage-folder";
import { sanitizeSvgBuffer } from "../../../sanitize-svg-buffer";
import { insertAsset } from "./store";
import type { UploadMediaAssetCommand, UploadMediaAssetResult } from "./types";
import { resolveAssetUrl } from "../../../asset-url";

const MEDIA_LIST_CACHE_PREFIX = "media:assets:";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// Upload server-buffered (blob-spec seção 4, "uploadMedia mantido para arquivos pequenos") —
// o arquivo já chega inteiro em memória (Server Action), então não precisa do fluxo de
// client-upload direto ao Blob (request-media-upload-ticket/confirm). Ainda assim grava no
// mesmo storagePort (Vercel Blob em produção), nunca em disco local (Fase 4/M1-M3 — local
// storage descontinuado).
export async function uploadMediaAsset(command: UploadMediaAssetCommand): Promise<UploadMediaAssetResult> {
  const handle = beginOperation({
    useCase: "media.upload-media-asset",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const validation = validateMediaUploadCandidate({ contentType: command.contentType, size: command.size });
  if (!validation.success) {
    endOperation(handle, validation);
    return validation;
  }

  // SVG pode carregar script embutido — sanitiza os bytes antes de gravar no storage (nunca o
  // que o client mandou como recebido). Só é possível aqui porque este caminho é
  // server-buffered (o servidor já tem os bytes em memória); ver assertTypeAllowedForDirectUpload
  // pra por que isso não é feito no fluxo de upload direto ao Blob.
  let dataToStore = command.data;
  if (command.contentType === "image/svg+xml") {
    const sanitized = sanitizeSvgBuffer(command.data);
    if (!sanitized.success) {
      endOperation(handle, sanitized);
      return sanitized;
    }
    dataToStore = sanitized.data;
  }

  const pathname = `${resolveMediaStorageFolder(command.contentType)}/${crypto.randomUUID()}-${sanitizeFilename(command.filename)}`;
  const stored = await storagePort.store({ key: pathname, data: dataToStore, contentType: command.contentType });
  const checksum = computeSha256Hex(dataToStore);

  const id = crypto.randomUUID();
  const asset = await insertAsset({
    id,
    filename: command.filename,
    pathname: stored.key,
    // Não público -> rota autorizada do app; público -> URL direta do storage (asset-url.ts).
    url: resolveAssetUrl({ id, pathname: stored.key, visibility: command.visibility }),
    contentType: command.contentType,
    size: stored.size,
    checksum,
    visibility: command.visibility,
    categoryId: command.categoryId ?? null,
    uploadedBy: command.actorId,
  });

  invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);
  endOperation(handle, { success: true });
  return { success: true, data: asset };
}
