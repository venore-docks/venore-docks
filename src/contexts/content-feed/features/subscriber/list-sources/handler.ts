import { authorizeActor } from "@/contexts/rbac";
import { listSources } from "./service";
import type { ListSourcesResult } from "./types";

// Não pública: expõe connectionKey (segredo dado pelo publicador) — mesma linha de list-connections.
export async function listSourcesHandler(): Promise<ListSourcesResult> {
  const authz = await authorizeActor("content-feed.sources.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return listSources();
}
