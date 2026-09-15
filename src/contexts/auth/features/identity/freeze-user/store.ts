import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";
import type { UserRegistrationStatus } from "../../../contracts/types";

export async function findUserStatus(userId: string): Promise<UserRegistrationStatus | null> {
  const [user] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
  return (user?.status as UserRegistrationStatus | undefined) ?? null;
}

export async function writeUserStatus(userId: string, status: UserRegistrationStatus): Promise<{ id: string } | null> {
  const [row] = await db.update(users).set({ status }).where(eq(users.id, userId)).returning({ id: users.id });
  return row ?? null;
}
