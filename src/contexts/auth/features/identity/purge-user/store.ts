import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";
import type { UserRegistrationStatus } from "../../../contracts/types";

// Só enxerga usuário já "removed" (remove-user) — purgeUser nunca deve conseguir "pular" o soft
// delete e apagar de verdade uma conta ainda ativa, mesmo que quem chame erre o id (mesmo racional
// de purge-media-asset/store.ts: findSoftDeletedAssetById).
export async function findRemovedUserStatus(userId: string): Promise<UserRegistrationStatus | null> {
  const [user] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
  return (user?.status as UserRegistrationStatus | undefined) ?? null;
}

export async function hardDeleteUserById(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

// cms.entries.author_id e media.assets.uploaded_by têm FK real pra auth.users.id sem onDelete —
// plugins de terceiros podem ter feito o mesmo sem o core saber (regra de isolamento não é
// seguida à risca hoje, ver docs/venore-docks.md). platform/identity-lifecycle/purge-user-safely.ts
// já checa cms/media antes de chegar aqui; isto é defesa em profundidade pra qualquer FK que essa
// checagem não cubra, traduzindo o erro cru do Postgres numa mensagem decente em vez de vazar o
// stack trace.
export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23503";
}
