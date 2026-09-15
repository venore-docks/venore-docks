import { listArticles } from "./service";
import type { ListArticlesQuery, ListArticlesResult } from "./types";

// Leitura pública do cache local sincronizado — sem authorizeActor. Consumida por outros
// contexts/plugins (ex: Broadcast, sessão futura) via barrel; nenhuma UI própria nesta fase.
export async function listArticlesHandler(query: ListArticlesQuery = {}): Promise<ListArticlesResult> {
  return listArticles(query);
}
