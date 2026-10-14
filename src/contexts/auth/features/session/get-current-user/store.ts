import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { auth } from "../../../auth.config";
import { users } from "../../../database/schema";

// cache() memoiza por request: getCurrentUserService (via getAdminPageData) e
// getCurrentUserRegistrationStatusService chamam isso de forma independente no mesmo request
// (ambos disparados por src/app/(platform)/layout.tsx), e sem memoização isso era 2 leituras de
// sessão (JWT/DB) por página em vez de 1 — mesmo padrão de resolve-active-theme.ts.
export const getSession = cache(async () => {
  return auth();
});

// cache() pelo mesmo motivo de getSession: getCurrentUser() é chamado por vários pontos do mesmo
// render (gate de admin, props de slot, outlets, authorizeActor, páginas) e cada chamada fazia
// um SELECT próprio. Fora de um render React (Server Action, route handler) não memoiza.
export const findAvatarMediaId = cache(async (userId: string): Promise<string | null> => {
  const [row] = await db.select({ avatarMediaId: users.avatarMediaId }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.avatarMediaId ?? null;
});
