import { authorizeActor } from "@/contexts/rbac";
import { publishThemeDraft } from "./service";
import type { PublishThemeDraftResult } from "./types";

// Só autoriza e delega. A validação do documento contra o registro de temas mora no composer de
// platform (platform/theme-engine/theme-config.ts), que é quem a action chama.
export async function publishThemeDraftHandler(): Promise<PublishThemeDraftResult> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return publishThemeDraft({ actorId: authz.actorId });
}
