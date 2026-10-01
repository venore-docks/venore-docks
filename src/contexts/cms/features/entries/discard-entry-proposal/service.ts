import { beginOperation, endOperation } from "@/observability";
import { canPublishInCategory, findRevision, resolveProposal } from "../../../shared/entry-revisions";
import { findEntryCategory } from "./store";
import type { DiscardEntryProposalCommand, DiscardEntryProposalResult } from "./types";

// Quem pode descartar: quem publica na categoria, ou o próprio autor da proposta (desistiu).
export async function discardEntryProposal(command: DiscardEntryProposalCommand): Promise<DiscardEntryProposalResult> {
  const handle = beginOperation({ useCase: "cms.discard-entry-proposal", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const fail = (code: string, message: string): DiscardEntryProposalResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const revision = await findRevision(command.revisionId);
  if (!revision || revision.kind !== "proposal") return fail("cms.revisions.not_found", "Proposta não encontrada.");
  if (revision.status !== "pending") return fail("cms.revisions.already_resolved", "Esta proposta já foi resolvida.");

  const entry = await findEntryCategory(revision.entryId);
  if (!entry) return fail("cms.entries.not_found", "Conteúdo não encontrado.");

  const isAuthor = revision.createdBy === command.actorId;
  if (!isAuthor && !(await canPublishInCategory(command.actorId, entry.categoryId))) {
    return fail("cms.entries.publish_required", "Só quem publica nesta categoria (ou o autor da proposta) pode descartá-la.");
  }

  if (!(await resolveProposal(revision.id, "discarded", command.actorId))) {
    return fail("cms.revisions.already_resolved", "Esta proposta já foi resolvida por outra pessoa.");
  }
  endOperation(handle, { success: true });
  return { success: true, data: undefined };
}
