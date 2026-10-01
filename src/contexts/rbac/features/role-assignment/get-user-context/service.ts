import { getCachedUserContext, setCachedUserContext, syncUserContextCacheVersion } from "../../../user-context-cache";
import { findUserRoleRows, findUserScopeRows } from "./store";
import { toUserRbacContext } from "./view";
import type { GetUserContextQuery, GetUserContextResult } from "./types";

export async function getUserContext(query: GetUserContextQuery): Promise<GetUserContextResult> {
  await syncUserContextCacheVersion();
  const cached = getCachedUserContext(query.userId);
  if (cached) {
    return { success: true, data: cached };
  }

  const [roleRows, scopeRows] = await Promise.all([
    findUserRoleRows(query.userId),
    findUserScopeRows(query.userId),
  ]);
  const context = toUserRbacContext(query.userId, roleRows, scopeRows);

  setCachedUserContext(query.userId, context);

  return { success: true, data: context };
}
