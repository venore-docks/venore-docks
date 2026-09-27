import { lte, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { rateLimits } from "@/infrastructure/database/platform-schema";
import type { RateLimitConfig, RateLimitResult } from "./in-memory-rate-limiter";

// Rate limit compartilhado entre instâncias (Postgres), um único statement atômico por hit:
// INSERT … ON CONFLICT DO UPDATE incrementa a janela corrente ou abre uma nova se venceu. O
// limitador em memória valia por processo — em serverless cada instância tinha o próprio balde.
//
// Falha aberta: se o banco não responder, deixa passar (e loga). O banco fora do ar já derruba o
// fluxo protegido (login, cadastro) de qualquer jeito; travar tudo por causa do limitador seria
// pior que o risco coberto.
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const windowInterval = sql`(${config.windowMs} * interval '1 millisecond')`;
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, expiresAt: sql`now() + ${windowInterval}` })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.expiresAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
          expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= now() THEN now() + ${windowInterval} ELSE ${rateLimits.expiresAt} END`,
        },
      })
      .returning({ count: rateLimits.count, expiresAt: rateLimits.expiresAt });

    const resetAt = row.expiresAt.getTime();
    return {
      allowed: row.count <= config.limit,
      remaining: Math.max(0, config.limit - row.count),
      resetAt,
    };
  } catch (error) {
    console.error(`[rate-limit] falha ao consultar "${key}" — liberando a requisição.`, error);
    return { allowed: true, remaining: config.limit, resetAt: Date.now() + config.windowMs };
  }
}

export async function deleteExpiredRateLimits(now: Date = new Date()): Promise<number> {
  const deleted = await db.delete(rateLimits).where(lte(rateLimits.expiresAt, now)).returning({ key: rateLimits.key });
  return deleted.length;
}
