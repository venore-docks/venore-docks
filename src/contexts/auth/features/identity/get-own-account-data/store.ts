import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { accounts, users } from "../../../database/schema";
import type { OwnAccountData } from "./types";

export async function findOwnAccountData(userId: string): Promise<OwnAccountData | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      avatarMediaId: users.avatarMediaId,
      passwordHash: users.passwordHash,
      mfaSecret: users.mfaSecret,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  const providers = await db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, userId));
  const { passwordHash, mfaSecret, ...profile } = row;
  return { ...profile, hasPassword: Boolean(passwordHash), twoFactorEnabled: Boolean(mfaSecret), linkedProviders: providers.map((p) => p.provider) };
}
