import { canPublishInCategory, listRevisionSummaries } from "../../../shared/entry-revisions";
import { assertCmsCategoryScope } from "../../../shared/scoped-authorization";
import { findEntryCategory } from "./store";
import type { ListEntryRevisionsCommand, ListEntryRevisionsResult } from "./types";

export async function listEntryRevisions(command: ListEntryRevisionsCommand): Promise<ListEntryRevisionsResult> {
  const entry = await findEntryCategory(command.entryId);
  if (!entry) {
    return { success: false, error: { code: "cms.entries.not_found", message: `Entry "${command.entryId}" não encontrada.` } };
  }
  const scope = await assertCmsCategoryScope(command.actorId, ["cms.entries.manage"], entry.categoryId);
  if (!scope.success) return scope;

  const [revisions, canPublish] = await Promise.all([
    listRevisionSummaries(command.entryId),
    canPublishInCategory(command.actorId, entry.categoryId),
  ]);
  return { success: true, data: { revisions, canPublish } };
}
