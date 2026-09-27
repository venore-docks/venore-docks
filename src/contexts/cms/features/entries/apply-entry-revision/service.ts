import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { invalidateCache, invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { canPublishInCategory, findRevision, isLive, recordProposal, recordSnapshot } from "../../../shared/entry-revisions";
import { assertCmsCategoryScope } from "../../../shared/scoped-authorization";
import { applyRevisionState, findEntryById, slugTakenByAnotherEntry } from "./store";
import type { ApplyEntryRevisionCommand, ApplyEntryRevisionResult } from "./types";

// Aplica uma PROPOSTA pendente (exige poder publicar) ou RESTAURA um snapshot do histórico. Em
// ambos os casos o estado atual vira um snapshot antes — nada se perde.
export async function applyEntryRevision(command: ApplyEntryRevisionCommand): Promise<ApplyEntryRevisionResult> {
  const handle = beginOperation({ useCase: "cms.apply-entry-revision", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const fail = (code: string, message: string): ApplyEntryRevisionResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const revision = await findRevision(command.revisionId);
  if (!revision) return fail("cms.revisions.not_found", "Revisão não encontrada.");
  const entry = await findEntryById(revision.entryId);
  if (!entry) return fail("cms.entries.not_found", "Conteúdo não encontrado.");

  const scope = await assertCmsCategoryScope(command.actorId, ["cms.entries.manage"], entry.categoryId);
  if (!scope.success) {
    endOperation(handle, { success: false, error: scope.error });
    return scope;
  }

  const canPublish =
    (await canPublishInCategory(command.actorId, entry.categoryId)) &&
    (revision.categoryId === entry.categoryId || (await canPublishInCategory(command.actorId, revision.categoryId)));

  if (revision.kind === "proposal") {
    if (revision.status !== "pending") return fail("cms.revisions.already_resolved", "Esta proposta já foi resolvida.");
    if (!canPublish) return fail("cms.entries.publish_required", "Aplicar uma proposta exige permissão de publicar nesta categoria.");
  } else if (isLive(entry) && !canPublish) {
    // Restaurar versão antiga de conteúdo no ar sem poder publicar -> vira proposta.
    const proposal = await recordProposal(entry.id, revision, command.actorId);
    endOperation(handle, { success: true, summary: `user:${command.actorId} propôs restaurar uma versão de "${entry.title}".` });
    return { success: true, data: { applied: false, proposalId: proposal.id } };
  }

  if (await slugTakenByAnotherEntry(entry.id, revision.categoryId, revision.slug)) {
    return fail("cms.entries.slug_taken", `Já existe outro conteúdo com o endereço "${revision.slug}" nessa categoria.`);
  }

  await recordSnapshot(entry, command.actorId);
  const applied = await applyRevisionState(revision, command.actorId);
  if (!applied) return fail("cms.revisions.already_resolved", "Esta proposta já foi resolvida por outra pessoa.");

  if (isLive(entry)) {
    invalidateCacheByPrefix("cms:entries:published");
    invalidateCacheByPrefix("cms:navigation");
  }
  if (revision.contentTypeIds) invalidateCache("cms:content-types");

  const summary =
    revision.kind === "proposal"
      ? `user:${command.actorId} aplicou uma proposta em "${entry.title}".`
      : `user:${command.actorId} restaurou uma versão anterior de "${entry.title}".`;
  endOperation(handle, { success: true, summary });
  await recordAuditEvent({
    action: revision.kind === "proposal" ? "cms.apply-entry-proposal" : "cms.restore-entry-revision",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary,
    detail: { entryId: entry.id, revisionId: revision.id },
  });
  return { success: true, data: { applied: true, proposalId: null } };
}
