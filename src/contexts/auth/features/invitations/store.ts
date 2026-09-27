import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { invitations, users } from "../../database/schema";

export type InvitationRow = { id: string; email: string; roleId: string; invitedBy: string; expiresAt: Date; createdAt: Date };

const pending = (now: Date) => and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, now));

export async function emailHasAccount(email: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = lower(${email})`).limit(1);
  return Boolean(row);
}

// Convite novo pro mesmo e-mail substitui os pendentes (só o último link vale).
export async function replaceInvitation(row: { email: string; roleId: string; invitedBy: string; tokenHash: string; expiresAt: Date }): Promise<string> {
  return db.transaction(async (tx) => {
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(invitations.email, row.email), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
    const [inserted] = await tx.insert(invitations).values(row).returning({ id: invitations.id });
    return inserted.id;
  });
}

export async function findPendingByTokenHash(tokenHash: string, now: Date): Promise<InvitationRow | null> {
  const [row] = await db
    .select({ id: invitations.id, email: invitations.email, roleId: invitations.roleId, invitedBy: invitations.invitedBy, expiresAt: invitations.expiresAt, createdAt: invitations.createdAt })
    .from(invitations)
    .where(and(eq(invitations.tokenHash, tokenHash), pending(now)))
    .limit(1);
  return row ?? null;
}

// Aceite atômico: só um envio do link passa.
export async function consumeByTokenHash(tokenHash: string, now: Date): Promise<InvitationRow | null> {
  const [row] = await db
    .update(invitations)
    .set({ acceptedAt: now })
    .where(and(eq(invitations.tokenHash, tokenHash), pending(now)))
    .returning({ id: invitations.id, email: invitations.email, roleId: invitations.roleId, invitedBy: invitations.invitedBy, expiresAt: invitations.expiresAt, createdAt: invitations.createdAt });
  return row ?? null;
}

export async function insertInvitedUser(email: string, name: string, passwordHash: string): Promise<string> {
  const [row] = await db.insert(users).values({ email, name, passwordHash, status: "approved" }).returning({ id: users.id });
  return row.id;
}

export async function listPendingInvitations(now: Date): Promise<InvitationRow[]> {
  return db
    .select({ id: invitations.id, email: invitations.email, roleId: invitations.roleId, invitedBy: invitations.invitedBy, expiresAt: invitations.expiresAt, createdAt: invitations.createdAt })
    .from(invitations)
    .where(pending(now))
    .orderBy(desc(invitations.createdAt))
    .limit(100);
}

export async function revokeInvitationById(id: string): Promise<boolean> {
  const rows = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, id), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id });
  return rows.length > 0;
}
