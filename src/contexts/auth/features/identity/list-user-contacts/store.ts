import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";

export type UserContact = { id: string; email: string; name: string | null };

// Contato (e-mail) de contas ATIVAS pelo id — uso de sistema (avisos), sem gate.
export async function findApprovedUserContacts(ids: string[]): Promise<UserContact[]> {
  if (ids.length === 0) return [];
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.status, "approved")));
}
