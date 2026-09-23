import { beginOperation, endOperation } from "@/observability";
import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { storagePort } from "@/infrastructure/storage";
import { computeSha256Hex } from "@/infrastructure/storage/checksum";
import { getOrCreateReservedCategory } from "../../../get-or-create-reserved-category";
import { resolveMediaStorageFolder } from "../../../resolve-media-storage-folder";
import { sanitizeSvgBuffer } from "../../../sanitize-svg-buffer";
import { insertAsset } from "../upload-media-asset/store";
import type { UploadReservedCategoryAssetCommand, UploadReservedCategoryAssetResult } from "./types";

const MEDIA_LIST_CACHE_PREFIX = "media:assets:";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// Sempre "private" e sempre na categoria reservada que o chamador nomeou — visibility/category
// nunca vêm do input. Genérico: era um handler por plugin (activity-submission, ticket-attachment)
// no core; virou este, parametrizado por categoryKey/categoryName.
export async function uploadReservedCategoryAsset(
  command: UploadReservedCategoryAssetCommand,
): Promise<UploadReservedCategoryAssetResult> {
  const handle = beginOperation({
    useCase: "media.upload-reserved-category-asset",
    actor: command.actorId ? { id: command.actorId, type: "user" } : { id: "anonymous", type: "system" },
    kind: "write",
  });

  const category = await getOrCreateReservedCategory(command.categoryKey, command.categoryName);

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

  const asset = await insertAsset({
    filename: command.filename,
    pathname: stored.key,
    url: stored.url,
    contentType: command.contentType,
    size: stored.size,
    checksum,
    visibility: "private",
    categoryId: category.id,
    uploadedBy: command.actorId,
  });

  invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);
  endOperation(handle, { success: true });
  return { success: true, data: asset };
}
