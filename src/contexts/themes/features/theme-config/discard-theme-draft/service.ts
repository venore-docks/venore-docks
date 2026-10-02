import { beginOperation, endOperation } from "@/observability";
import { deleteDraftRevision } from "./store";
import type { DiscardThemeDraftCommand, DiscardThemeDraftResult } from "./types";

// Descarta o rascunho compartilhado. Um cookie de preview que apontava pra ele deixa de render o
// rascunho sozinho (read-theme-override não acha a revisão e cai no publicado).
export async function discardThemeDraft(command: DiscardThemeDraftCommand): Promise<DiscardThemeDraftResult> {
  const handle = beginOperation({ useCase: "themes.theme-config.discard-draft", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const deleted = await deleteDraftRevision();
  if (!deleted.success) {
    endOperation(handle, { success: false, error: deleted.error });
    return deleted;
  }
  endOperation(handle, { success: true, summary: deleted.data ? "Rascunho de aparência descartado." : "Não havia rascunho de aparência." });
  return { success: true, data: { discarded: deleted.data !== null } };
}
