import { authorizeActor } from "@/contexts/rbac";
import { applyEntryRevision } from "./service";
import type { ApplyEntryRevisionInput, ApplyEntryRevisionResult } from "./types";

// Gate de seção: cms.entries.manage. Aplicar PROPOSTA exige ainda poder publicar na categoria —
// checado no service (recorte por categoria, docs/rbac-scoped-roles.md).
export async function applyEntryRevisionHandler(input: ApplyEntryRevisionInput): Promise<ApplyEntryRevisionResult> {
  if (input.revisionId.trim().length === 0) {
    return { success: false, error: { code: "cms.revisions.invalid_id", message: "revisionId não pode ser vazio." } };
  }
  const authz = await authorizeActor("cms.entries.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return applyEntryRevision({ ...input, actorId: authz.actorId });
}
