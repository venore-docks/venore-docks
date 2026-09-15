import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";
import type { SearchUsersQuery, UserSummary } from "./types";

// Mesmo padrão cursor de observability/features/list-audit-events/store.ts: cursor = id da última
// linha da página anterior, resolvido pro createdAt dela pra montar o `lt` da próxima página.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function findUsers(query: SearchUsersQuery): Promise<{ entries: UserSummary[]; hasMore: boolean }> {
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const conditions = [];
  if (query.id) conditions.push(eq(users.id, query.id));
  if (query.status) conditions.push(eq(users.status, query.status));
  if (query.search && query.search.trim().length > 0) {
    const term = `%${query.search.trim()}%`;
    conditions.push(or(ilike(users.name, term), ilike(users.email, term)));
  }

  if (query.cursor) {
    const [cursorRow] = await db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, query.cursor))
      .limit(1);
    if (cursorRow) conditions.push(lt(users.createdAt, cursorRow.createdAt));
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  return {
    entries: rows.slice(0, limit).map((row) => ({ ...row, status: row.status as UserSummary["status"] })),
    hasMore,
  };
}
