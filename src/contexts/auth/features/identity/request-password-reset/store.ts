import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { passwordResetTokens, users } from "../../../database/schema";

export async function findResettableUser(email: string): Promise<{ id: string; email: string; name: string | null } | null> {
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(sql`lower(${users.email}) = lower(${email})`, eq(users.status, "approved")))
    .limit(1);
  return row ?? null;
}

export async function hasRecentResetToken(userId: string, since: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, userId), gt(passwordResetTokens.createdAt, since)))
    .limit(1);
  return Boolean(row);
}

export async function insertResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
}
