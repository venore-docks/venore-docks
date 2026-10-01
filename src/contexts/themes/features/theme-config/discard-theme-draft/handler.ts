import { authorizeActor } from "@/contexts/rbac";
import { discardThemeDraft } from "./service";
import type { DiscardThemeDraftResult } from "./types";

export async function discardThemeDraftHandler(): Promise<DiscardThemeDraftResult> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return discardThemeDraft({ actorId: authz.actorId });
}
