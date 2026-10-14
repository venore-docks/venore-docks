import { authorizeActor } from "@/contexts/rbac";
import { getThemeDraft } from "./service";
import type { GetThemeDraftResult } from "./types";

// Rascunho é do admin (spec §4.4: settings.manage).
export async function getThemeDraftHandler(): Promise<GetThemeDraftResult> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return getThemeDraft();
}
