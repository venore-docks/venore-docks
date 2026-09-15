import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

// Chamado só pelo jwt() callback de auth.config.ts, a cada login por OAuth — nome de conta OAuth
// é sempre "o que o provedor manda" (pedido do dono: só quem loga por senha edita o próprio nome
// em /account). Escrita incondicional a cada login, mesmo padrão de record-user-login/store.ts —
// não vale a pena um SELECT antes só pra evitar um UPDATE idêntico.
export async function syncUserNameFromProvider(userId: string, name: string): Promise<void> {
  await db.update(users).set({ name }).where(eq(users.id, userId));
}
