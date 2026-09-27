import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

export async function findOwnPasswordHash(userId: string): Promise<string | null> {
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.passwordHash ?? null;
}

export async function writeOwnPasswordHash(userId: string, passwordHash: string): Promise<{ id: string } | null> {
  const [row] = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return row ?? null;
}
