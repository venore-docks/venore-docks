import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";
import type { UserRegistrationStatus } from "../../../contracts/types";

export async function findUserStatus(userId: string): Promise<UserRegistrationStatus | null> {
  const [user] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
  return (user?.status as UserRegistrationStatus | undefined) ?? null;
}

// Soft-delete/anonimização — NUNCA um DELETE físico: cms.entries.authorId e media.assets.uploadedBy
// têm FK real para auth.users.id sem onDelete (docs/venore-docks.md não documenta isso, mas o
// schema real de cms/media referencia auth.users direto), então apagar a linha quebraria com
// violação de FK assim que o usuário tiver qualquer conteúdo/mídia. email troca pra um placeholder
// (a coluna é NOT NULL UNIQUE, não dá pra nular) pra liberar o email original pra um novo cadastro.
export async function anonymizeUser(userId: string): Promise<{ id: string } | null> {
  const [row] = await db
    .update(users)
    .set({
      status: "removed",
      email: `removed+${userId}@deleted.invalid`,
      name: null,
      passwordHash: null,
      image: null,
      avatarMediaId: null,
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  return row ?? null;
}
