import { eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { scheduledJobRuns } from "@/infrastructure/database/platform-schema";

// Reivindica a tarefa numa única instrução atômica: só devolve linha se o intervalo já passou E
// ninguém está com o lock. Duas instâncias batendo ao mesmo tempo -> só uma ganha.
export async function claimJob(key: string, intervalMs: number, lockMs: number): Promise<boolean> {
  const interval = sql`(${intervalMs} * interval '1 millisecond')`;
  const lock = sql`(${lockMs} * interval '1 millisecond')`;
  const rows = await db
    .insert(scheduledJobRuns)
    .values({ key, lastStartedAt: sql`now()`, lockedUntil: sql`now() + ${lock}` })
    .onConflictDoUpdate({
      target: scheduledJobRuns.key,
      set: { lastStartedAt: sql`now()`, lockedUntil: sql`now() + ${lock}` },
      setWhere: sql`(${scheduledJobRuns.lockedUntil} IS NULL OR ${scheduledJobRuns.lockedUntil} < now())
        AND (${scheduledJobRuns.lastStartedAt} IS NULL OR ${scheduledJobRuns.lastStartedAt} <= now() - ${interval})`,
    })
    .returning({ key: scheduledJobRuns.key });
  return rows.length > 0;
}

export async function finishJob(key: string, status: "success" | "failure", error: string | null): Promise<void> {
  await db
    .update(scheduledJobRuns)
    .set({ lastFinishedAt: sql`now()`, lastStatus: status, lastError: error?.slice(0, 1000) ?? null, lockedUntil: null })
    .where(eq(scheduledJobRuns.key, key));
}

export async function listJobRuns() {
  return db.select().from(scheduledJobRuns).orderBy(scheduledJobRuns.key);
}
