import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { mfaRecoveryCodes, users } from "../../../database/schema";

export type MfaRow = {
  email: string;
  mfaSecret: string | null;
  mfaPendingSecret: string | null;
  mfaEnabledAt: Date | null;
  mfaLastStep: number | null;
};

export async function findMfaRow(userId: string): Promise<MfaRow | null> {
  const [row] = await db
    .select({
      email: users.email,
      mfaSecret: users.mfaSecret,
      mfaPendingSecret: users.mfaPendingSecret,
      mfaEnabledAt: users.mfaEnabledAt,
      mfaLastStep: users.mfaLastStep,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function setPendingSecret(userId: string, sealed: string): Promise<void> {
  await db.update(users).set({ mfaPendingSecret: sealed }).where(eq(users.id, userId));
}

export async function enableMfa(userId: string, sealed: string, step: number, recoveryCodeHashes: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ mfaSecret: sealed, mfaPendingSecret: null, mfaEnabledAt: new Date(), mfaLastStep: step })
      .where(eq(users.id, userId));
    await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
    await tx.insert(mfaRecoveryCodes).values(recoveryCodeHashes.map((codeHash) => ({ userId, codeHash })));
  });
}

export async function disableMfa(userId: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null, mfaLastStep: null })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
  return rows.length > 0;
}

// Atômico: só avança se o passo for mais novo que o último aceito (dois logins com o mesmo código
// em paralelo — só um passa).
export async function advanceLastStep(userId: string, step: number): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ mfaLastStep: step })
    .where(and(eq(users.id, userId), or(isNull(users.mfaLastStep), lt(users.mfaLastStep, step))))
    .returning({ id: users.id });
  return rows.length > 0;
}

export async function consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
  const rows = await db
    .update(mfaRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(mfaRecoveryCodes.userId, userId), eq(mfaRecoveryCodes.codeHash, codeHash), isNull(mfaRecoveryCodes.usedAt)))
    .returning({ id: mfaRecoveryCodes.id });
  return rows.length > 0;
}

export async function countUnusedRecoveryCodes(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mfaRecoveryCodes)
    .where(and(eq(mfaRecoveryCodes.userId, userId), isNull(mfaRecoveryCodes.usedAt)));
  return row?.count ?? 0;
}
