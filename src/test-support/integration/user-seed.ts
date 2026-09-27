// Seed genérico de usuário pros testes de integração do core. Fica fora de src/contexts/* e
// src/plugins/* de propósito: eslint-plugin-boundaries só classifica elementos por esses dois
// padrões de pasta, e este módulo precisa tocar o schema de auth diretamente — não existe API
// pública pra criar um usuário (só nasce via evento do DrizzleAdapter, exceção já documentada no
// AGENTS.md), então o insert em auth.users é o único acesso cru necessário.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "@/contexts/auth/database/schema";

export async function seedUser(
  overrides: Partial<{ email: string; name: string }> = {},
): Promise<{ id: string; email: string }> {
  const [row] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `${randomUUID()}@integration.test`,
      name: overrides.name ?? "Integration Test User",
      status: "approved",
    })
    .returning({ id: users.id, email: users.email });
  return row;
}

// Teardown de um usuário semeado (ex: teste de "usuário órfão" do birthdays, cujo createdByUserId
// não tem FK). Único acesso cru a auth.users que um plugin não conseguiria fazer sozinho.
export async function deleteUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}
