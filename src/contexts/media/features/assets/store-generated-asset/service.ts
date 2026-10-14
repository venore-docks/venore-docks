import { beginOperation, endOperation } from "@/observability";
import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { storagePort } from "@/infrastructure/storage";
import { computeSha256Hex } from "@/infrastructure/storage/checksum";
import { getOrCreateReservedCategory } from "../../../get-or-create-reserved-category";
import { resolveMediaStorageFolder } from "../../../resolve-media-storage-folder";
import { CONTENT_MISMATCH_ERROR, contentMatchesDeclaredType } from "../../../content-sniffing";
import { resolveAssetUrl } from "../../../asset-url";
import { MEDIA_ALLOWED_TYPES } from "../../../contracts/types";
import { findVariantsByAssetIds } from "../../../shared/asset-variants-store";
import { insertAsset } from "../upload-media-asset/store";
import { findAssetsInCategory, hardDeleteAssets } from "./store";
import type {
  DeleteGeneratedAssetsCommand,
  DeleteGeneratedAssetsResult,
  StoreGeneratedAssetCommand,
  StoreGeneratedAssetResult,
} from "./types";

const MEDIA_LIST_CACHE_PREFIX = "media:assets:";
const SYSTEM_ACTOR = { id: "system", type: "system" } as const;

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// Sem sessão e sem gate: só core/platform chamam (ex: contexts/speech). Nunca exposto no SDK.
export async function storeGeneratedAsset(command: StoreGeneratedAssetCommand): Promise<StoreGeneratedAssetResult> {
  const handle = beginOperation({ useCase: "media.store-generated-asset", actor: SYSTEM_ACTOR, kind: "write" });
  const fail = (error: { code: string; message: string }): StoreGeneratedAssetResult => {
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const allowed = MEDIA_ALLOWED_TYPES[command.contentType as keyof typeof MEDIA_ALLOWED_TYPES];
  if (!allowed) return fail({ code: "media.generated.type_not_allowed", message: `Tipo não permitido: ${command.contentType}.` });
  if (command.data.length > allowed.maxSizeBytes) {
    return fail({ code: "media.generated.too_large", message: "Arquivo gerado maior que o limite do tipo." });
  }
  if (!contentMatchesDeclaredType(command.contentType, command.data)) return fail({ ...CONTENT_MISMATCH_ERROR });

  const category = await getOrCreateReservedCategory(command.categoryKey, command.categoryName);
  const pathname = `${resolveMediaStorageFolder(command.contentType)}/${crypto.randomUUID()}-${sanitizeFilename(command.filename)}`;
  const stored = await storagePort.store({ key: pathname, data: command.data, contentType: command.contentType });

  const id = crypto.randomUUID();
  const asset = await insertAsset({
    id,
    filename: command.filename,
    pathname: stored.key,
    url: resolveAssetUrl({ id, pathname: stored.key, visibility: "public" }),
    contentType: command.contentType,
    size: stored.size,
    checksum: computeSha256Hex(command.data),
    visibility: "public",
    categoryId: category.id,
    uploadedBy: null,
  });

  invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);
  endOperation(handle, { success: true });
  return { success: true, data: asset };
}

export async function deleteGeneratedAssets(command: DeleteGeneratedAssetsCommand): Promise<DeleteGeneratedAssetsResult> {
  const handle = beginOperation({ useCase: "media.delete-generated-assets", actor: SYSTEM_ACTOR, kind: "write" });
  const found = await findAssetsInCategory(command.ids, command.categoryKey);
  for (const variant of await findVariantsByAssetIds(found.map((asset) => asset.id))) {
    await storagePort.remove(variant.pathname);
  }
  for (const asset of found) await storagePort.remove(asset.pathname);
  await hardDeleteAssets(found.map((asset) => asset.id));
  if (found.length > 0) invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);
  endOperation(handle, { success: true });
  return { success: true, data: { deleted: found.length } };
}
