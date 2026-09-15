import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { securityAuditEvents } from "../../database/schema";
import type { AuditEventSummary, ListAuditEventsQuery } from "./types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function findAuditEvents(
  query: ListAuditEventsQuery,
): Promise<{ entries: AuditEventSummary[]; hasMore: boolean }> {
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const conditions = [];
  if (query.actorId) conditions.push(eq(securityAuditEvents.actorId, query.actorId));
  // detail é jsonb — ->> extrai o campo como texto pra comparar. Coluna não indexada (volume de
  // auditoria por usuário é baixo o suficiente pra não justificar um índice funcional ainda).
  if (query.targetUserId) {
    conditions.push(sql`${securityAuditEvents.detail} ->> 'targetUserId' = ${query.targetUserId}`);
  }
  if (query.outcome) conditions.push(eq(securityAuditEvents.outcome, query.outcome));
  if (query.from) conditions.push(gte(securityAuditEvents.occurredAt, query.from));
  if (query.to) conditions.push(lte(securityAuditEvents.occurredAt, query.to));

  if (query.cursor) {
    const cursorRows = await db
      .select({ occurredAt: securityAuditEvents.occurredAt })
      .from(securityAuditEvents)
      .where(eq(securityAuditEvents.id, query.cursor))
      .limit(1);
    const cursorRow = cursorRows[0];
    if (cursorRow) {
      conditions.push(lt(securityAuditEvents.occurredAt, cursorRow.occurredAt));
    }
  }

  const rows = await db
    .select()
    .from(securityAuditEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(securityAuditEvents.occurredAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  return {
    entries: rows.slice(0, limit).map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      action: row.action,
      actorId: row.actorId,
      actorType: row.actorType,
      outcome: row.outcome as AuditEventSummary["outcome"],
      summary: row.summary,
      detail: row.detail ?? null,
    })),
    hasMore,
  };
}
