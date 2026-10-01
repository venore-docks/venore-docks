import { and, eq, gt, isNull, lt, or, isNotNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { passwordResetTokens, users } from "../../../database/schema";

// Consome o token atomicamente (UPDATE ... WHERE não usado e não vencido): dois envios do mesmo
// link nunca passam os dois.
export async function consumeResetToken(tokenHash: string, now: Date): Promise<string | null> {
  const [row] = await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
    .returning({ userId: passwordResetTokens.userId });
  return row?.userId ?? null;
}

export async function findUserStatus(userId: string): Promise<string | null> {
  const [row] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.status ?? null;
}

export async function writePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

// Os outros links pendentes da conta deixam de valer quando um é usado.
export async function deleteResetTokensOfUser(userId: string): Promise<void> {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
}

// Varredura (agendador): vencidos ou já usados.
export async function deleteStaleResetTokens(now: Date): Promise<number> {
  const rows = await db
    .delete(passwordResetTokens)
    .where(or(lt(passwordResetTokens.expiresAt, now), isNotNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });
  return rows.length;
}
