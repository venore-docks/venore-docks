import { authorizeActor } from "@/contexts/rbac";
import { listEntryRevisions } from "./service";
import type { ListEntryRevisionsInput, ListEntryRevisionsResult } from "./types";

export async function listEntryRevisionsHandler(input: ListEntryRevisionsInput): Promise<ListEntryRevisionsResult> {
  if (input.entryId.trim().length === 0) {
    return { success: false, error: { code: "cms.entries.invalid_id", message: "entryId não pode ser vazio." } };
  }
  const authz = await authorizeActor("cms.entries.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return listEntryRevisions({ ...input, actorId: authz.actorId });
}
