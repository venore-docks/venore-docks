import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

export async function findOwnCredential(userId: string): Promise<{ email: string; passwordHash: string | null } | null> {
  const [row] = await db.select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}
