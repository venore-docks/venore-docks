import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { beginOperation, endOperation } from "@/observability";
import type { OperationResult } from "@/shared/types";
import { restrictAssetsInCategory } from "./store";

const MEDIA_LIST_CACHE_PREFIX = "media:assets:";

// Aplica a restrição de uma categoria reservada aos arquivos que JÁ existem nela (ex: currículos
// enviados antes de o vagas declarar manifest.restrictedUploadCategories). Sem ator: é composição
// do sistema, chamada só por platform/media-lifecycle/apply-restricted-upload-categories.ts, que
// lê a regra do manifesto do plugin dono da categoria — nunca expor num handler.
export async function restrictReservedCategoryAssets(command: {
  categoryKey: string;
  accessPermission: string;
}): Promise<OperationResult<{ restricted: number }>> {
  const handle = beginOperation({
    useCase: "media.restrict-reserved-category-assets",
    actor: { id: "system", type: "system" },
    kind: "write",
  });
  const restricted = await restrictAssetsInCategory(command.categoryKey, command.accessPermission);
  if (restricted > 0) invalidateCacheByPrefix(MEDIA_LIST_CACHE_PREFIX);
  endOperation(handle, {
    success: true,
    summary: `${restricted} arquivo(s) da categoria "${command.categoryKey}" marcados como restritos (${command.accessPermission}).`,
  });
  return { success: true, data: { restricted } };
}
