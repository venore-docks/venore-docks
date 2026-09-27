import { beginOperation, endOperation } from "@/observability";
import { invalidateCacheByPrefix } from "../../../../../infrastructure/cache/memory-cache";
import { canPublishInCategory, isLive } from "../../../shared/entry-revisions";
import { assertCmsCategoryScope } from "../../../shared/scoped-authorization";
import { findEntryById, markEntryArchived } from "./store";
import type { ArchiveEntryCommand, ArchiveEntryResult } from "./types";

export async function archiveEntry(command: ArchiveEntryCommand): Promise<ArchiveEntryResult> {
  const handle = beginOperation({
    useCase: "cms.archive-entry",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existing = await findEntryById(command.id);
  if (!existing) {
    const error = { code: "cms.entries.not_found", message: `Entry "${command.id}" não encontrada.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  if (existing.status === "archived") {
    const error = { code: "cms.entries.already_archived", message: `Entry "${command.id}" já está arquivada.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  // Fase C: só arquiva entries nas categorias do próprio escopo.
  const scope = await assertCmsCategoryScope(command.actorId, ["cms.entries.manage"], existing.categoryId);
  if (!scope.success) {
    endOperation(handle, { success: false, error: scope.error });
    return { success: false, error: scope.error };
  }

  // Tirar do ar um conteúdo publicado é decisão editorial: exige poder publicar na categoria
  // (antes o papel author, só com cms.entries.manage, despublicava qualquer entry do escopo).
  if (isLive(existing) && !(await canPublishInCategory(command.actorId, existing.categoryId))) {
    const error = {
      code: "cms.entries.publish_required",
      message: "Arquivar um conteúdo publicado exige permissão de publicar.",
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const entry = await markEntryArchived(command.id);

  // Arquivar tira do ar uma entry que podia estar publicada — mesma invalidação de
  // publish-entry/update-entry (docs/venore-docks.md — Cache), aplicada sempre (mais simples do
  // que checar se existing.status === "published" e nunca incorreta: invalidar cache que já
  // estava vazio/frio não tem custo relevante).
  invalidateCacheByPrefix("cms:entries:published");
  invalidateCacheByPrefix("cms:navigation");

  endOperation(handle, { success: true });
  return { success: true, data: entry };
}
