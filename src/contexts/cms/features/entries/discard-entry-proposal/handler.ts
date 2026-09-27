import { authorizeActor } from "@/contexts/rbac";
import { discardEntryProposal } from "./service";
import type { DiscardEntryProposalInput, DiscardEntryProposalResult } from "./types";

export async function discardEntryProposalHandler(input: DiscardEntryProposalInput): Promise<DiscardEntryProposalResult> {
  if (input.revisionId.trim().length === 0) {
    return { success: false, error: { code: "cms.revisions.invalid_id", message: "revisionId não pode ser vazio." } };
  }
  const authz = await authorizeActor(["cms.entries.publish", "cms.entries.manage"]);
  if (!authz.authorized) return { success: false, error: authz.error };
  return discardEntryProposal({ ...input, actorId: authz.actorId });
}
