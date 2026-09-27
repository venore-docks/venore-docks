import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

// Compare-and-swap: só regrava se o hash ainda for o que foi verificado (uma troca de senha
// concorrente não é sobrescrita pelo hash antigo re-derivado).
export async function replacePasswordHash(userId: string, previousHash: string, nextHash: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ passwordHash: nextHash })
    .where(and(eq(users.id, userId), eq(users.passwordHash, previousHash)))
    .returning({ id: users.id });
  return rows.length > 0;
}
