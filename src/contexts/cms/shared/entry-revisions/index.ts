import { assertCmsCategoryScope } from "../scoped-authorization";
import { insertRevision, pruneSnapshots, stateOf } from "./store";
import type { RevisionState } from "./store";
import type { EntryRecord } from "../../contracts/types";

export { countPendingProposals, findRevision, listRevisionSummaries, resolveProposal, stateOf } from "./store";
export type { RevisionRow, RevisionState } from "./store";

// Histórico por entry: suficiente pra desfazer uma sequência longa de edições sem crescer sem fim.
const SNAPSHOTS_KEPT_PER_ENTRY = 50;

// Grava o estado ATUAL da entry antes de uma alteração (restaurável depois).
export async function recordSnapshot(entry: EntryRecord, actorId: string): Promise<void> {
  await insertRevision({ entryId: entry.id, kind: "snapshot", status: null, state: stateOf(entry), createdBy: actorId });
  await pruneSnapshots(entry.id, SNAPSHOTS_KEPT_PER_ENTRY);
}

export async function recordProposal(entryId: string, state: RevisionState, actorId: string): Promise<{ id: string }> {
  return insertRevision({ entryId, kind: "proposal", status: "pending", state, createdBy: actorId });
}

// Mexer no que está NO AR (entry publicada) exige poder publicar na categoria dela. Quem só tem
// cms.entries.manage (papel author) vira proposta.
export async function canPublishInCategory(actorId: string, categoryId: string | null): Promise<boolean> {
  const result = await assertCmsCategoryScope(actorId, ["cms.entries.publish"], categoryId);
  return result.success;
}

export function isLive(entry: EntryRecord): boolean {
  return entry.status === "published";
}
