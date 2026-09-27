import { eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

export async function incrementSessionVersion(userId: string): Promise<number | null> {
  const [row] = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });
  return row?.sessionVersion ?? null;
}

export async function findSessionVersion(userId: string): Promise<number | null> {
  const [row] = await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.sessionVersion ?? null;
}

// Uma leitura por request no callback session (status + versão juntos).
export async function findSessionState(userId: string): Promise<{ status: string; sessionVersion: number } | null> {
  const [row] = await db
    .select({ status: users.status, sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
