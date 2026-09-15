import { listArticlesForConnection } from "./service";
import type { ListArticlesForConnectionQuery, ListArticlesForConnectionResult } from "./types";

// Acesso por chave, não por sessão — sem authorizeActor (mesmo racional de getOutputState no
// plugin broadcast). Quem chama é outra instância venore-docks, nunca um ator humano logado aqui.
export async function listArticlesForConnectionHandler(
  query: ListArticlesForConnectionQuery,
): Promise<ListArticlesForConnectionResult> {
  if (query.key.trim().length === 0) {
    return { success: false, error: { code: "content-feed.connections.invalid_key", message: "Chave de conexão não informada." } };
  }

  return listArticlesForConnection(query);
}
