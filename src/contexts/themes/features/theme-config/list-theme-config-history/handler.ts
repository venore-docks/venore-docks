import { authorizeActor } from "@/contexts/rbac";
import { listThemeConfigHistory } from "./service";
import type { ListThemeConfigHistoryResult } from "./types";

export async function listThemeConfigHistoryHandler(): Promise<ListThemeConfigHistoryResult> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return listThemeConfigHistory();
}
