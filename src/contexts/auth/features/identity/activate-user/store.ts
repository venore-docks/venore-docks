import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

export async function markUserApproved(userId: string): Promise<boolean> {
  const rows = await db.update(users).set({ status: "approved" }).where(eq(users.id, userId)).returning({ id: users.id });
  return rows.length > 0;
}
