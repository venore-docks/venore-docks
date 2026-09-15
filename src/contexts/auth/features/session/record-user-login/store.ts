import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

// Só alimenta a aba de atividade do perfil admin (/admin/community/[userId]) — não faz parte de
// nenhuma checagem de autorização, por isso não é uma feature com handler/authorizeActor: é um
// fire-and-forget chamado direto pelo evento signIn de auth.config.ts (mesma exceção documentada
// ali pra findUserStatusById — composition root do Auth.js não passa pelo handler de uma feature).
export async function recordUserLogin(userId: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}
