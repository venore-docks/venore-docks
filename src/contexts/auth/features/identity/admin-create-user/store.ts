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

// Conta criada pelo admin já nasce "approved" — explícito, porque o default do schema é
// "pending" (fail-closed).
export async function insertUser(input: { email: string; name: string; passwordHash: string }): Promise<CreatedUser> {
  const [row] = await db
    .insert(users)
    .values({ email: input.email, name: input.name, passwordHash: input.passwordHash, status: "approved" })
    .returning({ id: users.id, email: users.email, name: users.name });
  return row;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}
