import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";
import type { UserRegistrationStatus } from "../../../contracts/types";

export async function findIdentityById(id: string): Promise<{ email: string; status: UserRegistrationStatus } | null> {
  const [row] = await db.select({ email: users.email, status: users.status }).from(users).where(eq(users.id, id)).limit(1);
  return row ? { email: row.email, status: row.status as UserRegistrationStatus } : null;
}
