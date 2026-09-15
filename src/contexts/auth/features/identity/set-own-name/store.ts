import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

export async function writeOwnName(userId: string, name: string): Promise<{ id: string } | null> {
  const [row] = await db.update(users).set({ name }).where(eq(users.id, userId)).returning({ id: users.id });
  return row ?? null;
}
