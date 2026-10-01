import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { users } from "../../../database/schema";
import type { UserRegistrationStatus } from "../../../contracts/types";
import type { FoundUser } from "./types";

export async function findUserByEmail(email: string): Promise<FoundUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      avatarMediaId: users.avatarMediaId,
      passwordHash: users.passwordHash,
      status: users.status,
    })
    .from(users)
    // lower() dos dois lados: bate com conta gravada pelo OAuth com maiúsculas e usa o índice
    // único users_email_lower_idx.
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (!row) return null;
  return { ...row, status: row.status as UserRegistrationStatus };
}
