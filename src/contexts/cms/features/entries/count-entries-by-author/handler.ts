// Leitura pública (sem authorizeActor): só devolve uma contagem, nunca identidade/conteúdo —
// usada por platform/identity-lifecycle/purge-user-safely.ts pra decidir se um hard delete de
// usuário é seguro (mesmo racional de count-users-with-permissions/handler.ts).
import { countEntriesByAuthor } from "./service";
import type { CountEntriesByAuthorQuery, CountEntriesByAuthorResult } from "./types";

export async function countEntriesByAuthorHandler(query: CountEntriesByAuthorQuery): Promise<CountEntriesByAuthorResult> {
  return countEntriesByAuthor(query);
}
