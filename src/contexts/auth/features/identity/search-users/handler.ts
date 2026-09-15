// Sem verificação de autorização própria, mesmo racional de list-users/handler.ts: quem autoriza é
// quem compõe (o loader de página de app/admin/community, gated por rbac.users.manage antes de
// chegar aqui).
import { searchUsers } from "./service";
import type { SearchUsersQuery, SearchUsersResult } from "./types";

export async function searchUsersHandler(query: SearchUsersQuery = {}): Promise<SearchUsersResult> {
  return searchUsers(query);
}
