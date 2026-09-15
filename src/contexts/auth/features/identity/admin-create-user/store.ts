import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";
import type { CreatedUser } from "./types";

// Mesmo padrão de registration/register-with-password/store.ts — cada feature dona da própria
// query, sem importar o store de outra feature (convenção do context: nenhuma abstração
// compartilhada além do necessário).
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return row?.id ?? null;
}

// status não é setado aqui de propósito — o default do schema ("approved") já é o que uma conta
// criada pelo admin deve ter (diferente do fluxo de auto-registro, que rebaixa pra "pending" via
// provisionUser logo depois).
export async function insertUser(input: { email: string; name: string; passwordHash: string }): Promise<CreatedUser> {
  const [row] = await db
    .insert(users)
    .values({ email: input.email, name: input.name, passwordHash: input.passwordHash })
    .returning({ id: users.id, email: users.email, name: users.name });
  return row;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}
