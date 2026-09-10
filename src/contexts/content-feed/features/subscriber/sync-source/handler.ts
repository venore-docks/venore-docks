import { authorizeActor } from "@/contexts/rbac";
import { syncSource } from "./service";
import type { SyncSourceInput, SyncSourceResult } from "./types";

export async function syncSourceHandler(input: SyncSourceInput): Promise<SyncSourceResult> {
  if (input.id.trim().length === 0) {
    return { success: false, error: { code: "content-feed.sources.invalid_id", message: "id da fonte não pode ser vazio." } };
  }

  const authz = await authorizeActor("content-feed.sources.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return syncSource({ ...input, actorId: authz.actorId });
}
