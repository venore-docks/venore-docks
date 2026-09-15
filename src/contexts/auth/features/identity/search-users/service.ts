import { findUsers } from "./store";
import type { SearchUsersQuery, SearchUsersResult } from "./types";

export async function searchUsers(query: SearchUsersQuery): Promise<SearchUsersResult> {
  const data = await findUsers(query);
  return { success: true, data };
}
