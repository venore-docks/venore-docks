import { authorizeActor } from "@/contexts/rbac";
import { listConnections } from "./service";
import type { ListConnectionsResult } from "./types";

// Diferente de list-entries/list-categories do CMS, esta leitura NÃO é pública — devolve a `key`
// de cada conexão em texto plano (é o segredo que o assinante apresenta a cada sync), então exige
// a mesma permission de gerenciar conexões.
export async function listConnectionsHandler(): Promise<ListConnectionsResult> {
  const authz = await authorizeActor("content-feed.connections.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return listConnections();
}
